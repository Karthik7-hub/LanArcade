import 'dart:async';
import 'dart:convert';
import 'package:flutter_js/flutter_js.dart';
import '../shared/models.dart';

typedef StateCallback = void Function(Map<String, dynamic> state);
typedef PrivateStateCallback = void Function(String playerId, Map<String, dynamic> state);
typedef AchievementCallback = void Function(String playerId, String achievementId);

class JsEngine {
  late JavascriptRuntime _runtime;
  final GameManifest manifest;
  final StateCallback onPublicState;
  final PrivateStateCallback onPrivateState;
  final AchievementCallback onAchievement;
  
  Timer? _tickTimer;
  bool _isInitialized = false;

  JsEngine({
    required this.manifest,
    required this.onPublicState,
    required this.onPrivateState,
    required this.onAchievement,
  }) {
    _runtime = getJavascriptRuntime();
    _setupBridge();
  }

  void _setupBridge() {
    _runtime.onMessage('broadcastPublicState', (dynamic args) {
      try {
        final Map<String, dynamic> state = args is String 
            ? Map<String, dynamic>.from(jsonDecode(args) as Map)
            : <String, dynamic>{};
        onPublicState(state);
      } catch (e) {
        print('Error parsing public state: $e');
      }
    });

    _runtime.onMessage('sendPrivateState', (dynamic args) {
      try {
        if (args is String) {
          final Map<String, dynamic> data = Map<String, dynamic>.from(jsonDecode(args) as Map);
          final String playerId = data['playerId'] as String? ?? '';
          final Map<String, dynamic> state = data['state'] is Map
              ? Map<String, dynamic>.from(data['state'] as Map)
              : <String, dynamic>{};
          onPrivateState(playerId, state);
        }
      } catch (e) {
        print('Error parsing private state: $e');
      }
    });

    _runtime.onMessage('unlockAchievement', (dynamic args) {
      try {
        if (args is String) {
          final Map<String, dynamic> data = Map<String, dynamic>.from(jsonDecode(args) as Map);
          final String playerId = data['playerId'] as String? ?? '';
          final String achievementId = data['achievementId'] as String? ?? '';
          onAchievement(playerId, achievementId);
        }
      } catch (e) {
        print('Error parsing achievement: $e');
      }
    });

    _runtime.onMessage('consoleLog', (dynamic args) {
      print('[JS Console] $args');
    });

    _runtime.evaluate('''
      var console = {
        log: function() {
          var args = Array.prototype.slice.call(arguments);
          var msg = args.map(function(arg) {
            return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
          }).join(' ');
          sendMessage('consoleLog', JSON.stringify(msg));
        }
      };
    ''');
    
    _runtime.evaluate('''
      var Arcade = {
        broadcastPublicState: function(state) {
          sendMessage('broadcastPublicState', JSON.stringify(state));
        },
        sendPrivateState: function(playerId, state) {
          sendMessage('sendPrivateState', JSON.stringify({ playerId: playerId, state: state }));
        },
        unlockAchievement: function(playerId, achievementId) {
          sendMessage('unlockAchievement', JSON.stringify({ playerId: playerId, achievementId: achievementId }));
        }
      };
    ''');
  }

  /// Helper to safely inject JSON into a JS evaluate call.
  /// Wraps JSON string in single-quotes with proper escaping.
  String _escapeForJs(String jsonString) {
    // Escape single quotes and backslashes for JS string literal
    return jsonString
        .replaceAll(r'\', r'\\')
        .replaceAll("'", r"\'")
        .replaceAll('\n', r'\n')
        .replaceAll('\r', r'\r');
  }

  Future<void> load(String code) async {
    final result = _runtime.evaluate(code);
    if (result.isError) {
      throw Exception('Failed to load plugin: ${result.stringResult}');
    }

    // Inject defaults after loading game code to prevent const/let re-declaration errors
    final injectRes = _runtime.evaluate('''
      if (typeof engine === 'undefined') {
        engine = {};
      }
      var defaults = {
        onLoad: function() { console.log("Default onLoad"); },
        onInit: function(settings, players) { console.log("Default onInit"); },
        onAction: function(player, action) { console.log("Default onAction"); },
        onPlayerJoin: function(player) { console.log("Default onPlayerJoin"); },
        onPlayerLeave: function(player) { console.log("Default onPlayerLeave"); },
        onPause: function() { console.log("Default onPause"); },
        onResume: function() { console.log("Default onResume"); },
        onTick: function(dt) { /* optional */ },
        onDestroy: function() { console.log("Default onDestroy"); }
      };
      for (var key in defaults) {
        if (typeof engine[key] === 'undefined') {
          engine[key] = defaults[key];
        }
      }
    ''');
    if (injectRes.isError) {
      print('JS Engine defaults injection error: ${injectRes.stringResult}');
    }

    final loadRes = _runtime.evaluate('engine.onLoad()');
    if (loadRes.isError) {
      print('JS Engine onLoad error: ${loadRes.stringResult}');
    }
  }

  void init(Map<String, dynamic> settings, List<Player> players) {
    final playersJson = _escapeForJs(jsonEncode(players.map((p) => p.toJson()).toList()));
    final settingsJson = _escapeForJs(jsonEncode(settings));
    final result = _runtime.evaluate("engine.onInit(JSON.parse('$settingsJson'), JSON.parse('$playersJson'))");
    if (result.isError) {
      print('JS Engine init error: ${result.stringResult}');
    }
    _isInitialized = true;
    
    if (manifest.permissions.contains('timers')) {
      _startTick();
    }
  }

  void _startTick() {
    _tickTimer?.cancel();
    _tickTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (_isInitialized) {
        final result = _runtime.evaluate('engine.onTick(0.5)');
        if (result.isError) {
          print('JS Engine onTick error: ${result.stringResult}');
        }
      }
    });
  }

  void handleAction(Player player, String type, Map<String, dynamic> data) {
    final playerJson = _escapeForJs(jsonEncode(player.toJson()));
    final actionJson = _escapeForJs(jsonEncode({'type': type, 'data': data}));
    final result = _runtime.evaluate("engine.onAction(JSON.parse('$playerJson'), JSON.parse('$actionJson'))");
    if (result.isError) {
      print('JS Engine handleAction error: ${result.stringResult}');
    }
  }

  void playerJoined(Player player) {
    final playerJson = _escapeForJs(jsonEncode(player.toJson()));
    final result = _runtime.evaluate("engine.onPlayerJoin(JSON.parse('$playerJson'))");
    if (result.isError) {
      print('JS Engine playerJoined error: ${result.stringResult}');
    }
    // Force the engine to re-sync state for the reconnected player
    final syncRes = _runtime.evaluate("if (typeof engine.sync === 'function') engine.sync();");
    if (syncRes.isError) {
      print('JS Engine sync error: ${syncRes.stringResult}');
    }
  }

  void playerLeft(Player player) {
    final playerJson = _escapeForJs(jsonEncode(player.toJson()));
    final result = _runtime.evaluate("engine.onPlayerLeave(JSON.parse('$playerJson'))");
    if (result.isError) {
      print('JS Engine playerLeft error: ${result.stringResult}');
    }
  }

  void pause() {
    _tickTimer?.cancel();
    final result = _runtime.evaluate('engine.onPause()');
    if (result.isError) {
      print('JS Engine pause error: ${result.stringResult}');
    }
  }

  void resume() {
    final result = _runtime.evaluate('engine.onResume()');
    if (result.isError) {
      print('JS Engine resume error: ${result.stringResult}');
    }
    if (_isInitialized && manifest.permissions.contains('timers')) {
      _startTick();
    }
  }

  void dispose() {
    _tickTimer?.cancel();
    if (_isInitialized) {
      _runtime.evaluate('engine.onDestroy()');
    }
    _runtime.dispose();
  }
}

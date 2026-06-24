import 'dart:async';
import 'dart:convert';
import 'package:flutter_js/flutter_js.dart';
import 'package:logging/logging.dart';
import '../shared/models.dart';

typedef StateCallback = void Function(Map<String, dynamic> state);
typedef PrivateStateCallback = void Function(String playerId, Map<String, dynamic> state);
typedef AchievementCallback = void Function(String playerId, String achievementId);
typedef LogCallback = void Function(String message);

class JsEngine {
  static final _log = Logger('JsEngine');
  late JavascriptRuntime _runtime;
  final GameManifest manifest;
  final StateCallback onPublicState;
  final PrivateStateCallback onPrivateState;
  final AchievementCallback onAchievement;
  final LogCallback? onLog;
  
  Timer? _tickTimer;
  bool _isInitialized = false;

  JsEngine({
    required this.manifest,
    required this.onPublicState,
    required this.onPrivateState,
    required this.onAchievement,
    this.onLog,
  }) {
    _runtime = getJavascriptRuntime();
    _setupBridge();
  }

  void _setupBridge() {
    _runtime.onMessage('broadcastPublicState', (dynamic args) {
      try {
        final state = _parseJsArgs(args);
        onPublicState(state);
      } catch (e) {
        _log.warning('Error parsing public state: $e');
      }
    });

    _runtime.onMessage('sendPrivateState', (dynamic args) {
      try {
        final data = _parseJsArgs(args);
        final String playerId = data['playerId'] as String? ?? '';
        final Map<String, dynamic> state = data['state'] is Map
            ? Map<String, dynamic>.from(data['state'] as Map)
            : <String, dynamic>{};
        onPrivateState(playerId, state);
      } catch (e) {
        _log.warning('Error parsing private state: $e');
      }
    });

    _runtime.onMessage('unlockAchievement', (dynamic args) {
      try {
        final data = _parseJsArgs(args);
        final String playerId = data['playerId'] as String? ?? '';
        final String achievementId = data['achievementId'] as String? ?? '';
        onAchievement(playerId, achievementId);
      } catch (e) {
        _log.warning('Error parsing achievement: $e');
      }
    });

    _runtime.onMessage('consoleLog', (dynamic args) {
      dynamic payload = args;
      if (args is List && args.isNotEmpty) {
        payload = args.first;
      }
      _log.info('[JS Console] $payload');
      onLog?.call('[JS Console] $payload');
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
    
    _runtime.evaluate(r'''
      function _decodeBase64(str) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var output = '';
        str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');
        var i = 0;
        while (i < str.length) {
          var enc1 = chars.indexOf(str.charAt(i++));
          var enc2 = chars.indexOf(str.charAt(i++));
          var enc3 = chars.indexOf(str.charAt(i++));
          var enc4 = chars.indexOf(str.charAt(i++));
          var chr1 = (enc1 << 2) | (enc2 >> 4);
          var chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
          var chr3 = ((enc3 & 3) << 6) | enc4;
          output += String.fromCharCode(chr1);
          if (enc3 != 64) output += String.fromCharCode(chr2);
          if (enc4 != 64) output += String.fromCharCode(chr3);
        }
        try {
          return decodeURIComponent(escape(output));
        } catch(e) {
          return output;
        }
      }
    ''');
  }

  Map<String, dynamic> _parseJsArgs(dynamic args) {
    if (args == null) return <String, dynamic>{};
    
    dynamic payload = args;
    if (args is List && args.isNotEmpty) {
      payload = args.first;
    }
    
    if (payload is Map) {
      return Map<String, dynamic>.from(payload);
    } else if (payload is String) {
      try {
        final decoded = jsonDecode(payload);
        if (decoded is Map) {
          return Map<String, dynamic>.from(decoded);
        }
      } catch (e) {
        _log.warning('Error decoding JS message JSON: $e. Payload was: $payload');
      }
    }
    return <String, dynamic>{};
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
      _log.severe('JS Engine defaults injection error: ${injectRes.stringResult}');
    }

    final loadRes = _runtime.evaluate('engine.onLoad()');
    if (loadRes.isError) {
      _log.severe('JS Engine onLoad error: ${loadRes.stringResult}');
    }
  }

  void init(Map<String, dynamic> settings, List<Player> players) {
    final playersJson = jsonEncode(players.map((p) => p.toJson()).toList());
    final settingsJson = jsonEncode(settings);
    final playersB64 = base64.encode(utf8.encode(playersJson));
    final settingsB64 = base64.encode(utf8.encode(settingsJson));
    final result = _runtime.evaluate("engine.onInit(JSON.parse(_decodeBase64('$settingsB64')), JSON.parse(_decodeBase64('$playersB64')))");
    if (result.isError) {
      _log.severe('JS Engine init error: ${result.stringResult}');
    }
    _isInitialized = true;
    
    if (manifest.permissions.contains('timers')) {
      _startTick();
    }
  }

  void _startTick() {
    _tickTimer?.cancel();
    
    int tickRate = 2; // Default to 2 Hz (500ms)
    final rateRes = _runtime.evaluate(
      '(typeof engine !== "undefined" && engine.config && typeof engine.config.tickRate === "number") ? engine.config.tickRate : 2'
    );
    if (!rateRes.isError) {
      final val = rateRes.rawResult;
      if (val is num) {
        tickRate = val.toInt();
      } else if (rateRes.stringResult != 'null') {
        tickRate = int.tryParse(rateRes.stringResult) ?? 2;
      }
    }
    
    final intervalMs = (1000 / tickRate).round();
    final dt = intervalMs / 1000.0;
    
    _log.info('Starting JS tick timer with rate $tickRate Hz (interval: ${intervalMs}ms, dt: $dt)');
    
    _tickTimer = Timer.periodic(Duration(milliseconds: intervalMs), (timer) {
      if (_isInitialized) {
        final result = _runtime.evaluate('engine.onTick($dt)');
        if (result.isError) {
          _log.severe('JS Engine onTick error: ${result.stringResult}');
        }
      }
    });
  }

  void handleAction(Player player, String type, Map<String, dynamic> data) {
    final playerJson = jsonEncode(player.toJson());
    final actionJson = jsonEncode({'type': type, 'data': data});
    final playerB64 = base64.encode(utf8.encode(playerJson));
    final actionB64 = base64.encode(utf8.encode(actionJson));
    final result = _runtime.evaluate("engine.onAction(JSON.parse(_decodeBase64('$playerB64')), JSON.parse(_decodeBase64('$actionB64')))");
    if (result.isError) {
      _log.severe('JS Engine handleAction error: ${result.stringResult}');
    }
  }

  void playerJoined(Player player) {
    final playerJson = jsonEncode(player.toJson());
    final playerB64 = base64.encode(utf8.encode(playerJson));
    final result = _runtime.evaluate("engine.onPlayerJoin(JSON.parse(_decodeBase64('$playerB64')))");
    if (result.isError) {
      _log.severe('JS Engine playerJoined error: ${result.stringResult}');
    }
    // Force the engine to re-sync state for the reconnected player
    final syncRes = _runtime.evaluate("if (typeof engine.sync === 'function') engine.sync();");
    if (syncRes.isError) {
      _log.severe('JS Engine sync error: ${syncRes.stringResult}');
    }
  }

  void playerLeft(Player player) {
    final playerJson = jsonEncode(player.toJson());
    final playerB64 = base64.encode(utf8.encode(playerJson));
    final result = _runtime.evaluate("engine.onPlayerLeave(JSON.parse(_decodeBase64('$playerB64')))");
    if (result.isError) {
      _log.severe('JS Engine playerLeft error: ${result.stringResult}');
    }
  }

  void settingsUpdated(Map<String, dynamic> settings) {
    final settingsJson = jsonEncode(settings);
    final settingsB64 = base64.encode(utf8.encode(settingsJson));
    final result = _runtime.evaluate("if (typeof engine.onSettingsUpdate === 'function') { engine.onSettingsUpdate(JSON.parse(_decodeBase64('$settingsB64'))); } else { engine.state.settings = { ...engine.state.settings, ...JSON.parse(_decodeBase64('$settingsB64')) }; }");
    if (result.isError) {
      _log.severe('JS Engine settingsUpdated error: ${result.stringResult}');
    }
    final syncRes = _runtime.evaluate("if (typeof engine.sync === 'function') engine.sync();");
    if (syncRes.isError) {
      _log.severe('JS Engine sync error after settings update: ${syncRes.stringResult}');
    }
  }

  void pause() {
    _tickTimer?.cancel();
    final result = _runtime.evaluate('engine.onPause()');
    if (result.isError) {
      _log.severe('JS Engine pause error: ${result.stringResult}');
    }
  }

  void resume() {
    final result = _runtime.evaluate('engine.onResume()');
    if (result.isError) {
      _log.severe('JS Engine resume error: ${result.stringResult}');
    }
    if (_isInitialized && manifest.permissions.contains('timers')) {
      _startTick();
    }
  }

  void restoreState(Map<String, dynamic> state) {
    final stateJson = jsonEncode(state);
    final stateB64 = base64.encode(utf8.encode(stateJson));
    final result = _runtime.evaluate('''
      if (typeof engine !== 'undefined' && engine.state) {
        var recovered = JSON.parse(_decodeBase64('$stateB64'));
        for (var key in recovered) {
          engine.state[key] = recovered[key];
        }
        if (typeof recovered.deaths !== 'undefined') {
          engine.state.teamDeaths = recovered.deaths;
        }
        if (typeof engine.sync === 'function') {
          engine.sync();
        }
      }
    ''');
    if (result.isError) {
      _log.severe('JS Engine restoreState error: ${result.stringResult}');
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

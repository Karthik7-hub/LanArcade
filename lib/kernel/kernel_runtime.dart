import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as io;
import 'package:shelf_router/shelf_router.dart';
import 'package:shelf_web_socket/shelf_web_socket.dart';
import 'package:shelf_static/shelf_static.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:uuid/uuid.dart';
import 'package:path/path.dart' as p;
import 'package:drift/drift.dart' as drift;
import 'package:logging/logging.dart';

import 'connection_manager.dart';
import 'kernel_manager.dart';
import '../rooms/room_service.dart';
import '../database/database.dart';
import '../shared/models.dart' as models;
import 'asset_extractor.dart';
import '../plugins/js_engine.dart';
import '../plugins/plugin_manager.dart';
import 'handlers/message_handler.dart';
import 'handlers/player_handler.dart';
import 'handlers/room_handler.dart';
import 'handlers/game_handler.dart';
import 'game_engine_factory.dart';

final _log = Logger('KernelRuntime');

class KernelRuntime implements KernelContext {
  @override
  final PluginManager pluginManager;
  @override
  final AppDatabase db;
  @override
  final RoomService roomService;
  @override
  final ConnectionManager connectionManager = ConnectionManager();
  @override
  final Map<String, JsEngine> activeEngines = {};
  @override
  final Map<String, models.Room> roomData = {};

  final Map<String, Timer> _cleanupTimers = {};
  @override
  Map<String, Timer> get cleanupTimers => _cleanupTimers;

  final Map<String, DateTime> _lastStateWrite = {};
  @override
  Map<String, DateTime> get lastStateWrite => _lastStateWrite;

  final Uuid _uuid = const Uuid();
  @override
  Uuid get uuid => _uuid;

  HttpServer? _server;
  bool _isRunning = false;
  bool get isRunning => _isRunning;

  final StreamController<Map<String, dynamic>> _statsController =
      StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get statsStream => _statsController.stream;

  final MessageRouter _router = MessageRouter();

  @override
  void logSystemEvent(String msg) {
    _log.info(msg);
    _statsController.add({'log': msg});
  }

  @override
  void addStats(Map<String, dynamic> event) {
    _statsController.add(event);
  }

  KernelRuntime({
    required this.pluginManager,
    required this.db,
    required this.roomService,
  }) {
    // Register all message handlers.
    _router.register('ping', PingHandler());
    _router.register('player.identify', PlayerHandler());
    _router.register('room.create', RoomCreateHandler());
    _router.register('room.join', RoomJoinHandler());
    _router.register('room.update_settings', RoomUpdateSettingsHandler());
    _router.register('room.change_game', RoomChangeGameHandler());
    _router.register('room.reset', RoomResetHandler());
    _router.register('room.leave', RoomLeaveHandler());
    _router.register('game.action', GameActionHandler());
  }

  Future<void> start(String shellAssetsPath, {Duration pingInterval = const Duration(seconds: 30)}) async {
    if (_isRunning) return;

    _statsController.add({'log': 'SERVER_STARTING', 'status': 'starting'});

    // Scan for game plugins
    await pluginManager.scanPlugins();
    _statsController.add({
      'log': 'PLUGINS_LOADED: ${pluginManager.availableGames.length} games found'
    });
    for (final game in pluginManager.availableGames) {
      await AssetExtractor.extractGameAssets(game.id);
    }

    // Recovery logic
    await _recoverRooms();

    // Build routes
    final router = Router();

    router.get('/health', (Request request) {
      return Response.ok(
          jsonEncode({'status': 'ok', 'message': 'Kernel is alive'}),
          headers: {'content-type': 'application/json'});
    });

    // API: List available games
    router.get('/api/games', (Request request) {
      final games = pluginManager.availableGames.map((m) => m.toJson()).toList();
      return Response.ok(jsonEncode(games),
          headers: {'content-type': 'application/json'});
    });

    // API: List all registered players with stats
    router.get('/api/players', (Request request) async {
      final players = await db.select(db.players).get();
      final result = <Map<String, dynamic>>[];
      for (final p in players) {
        final statsList = await (db.select(db.gameStats)..where((t) => t.playerId.equals(p.id))).get();
        int totalWins = 0;
        final gameWins = <String, int>{};
        for (var stat in statsList) {
          totalWins += stat.wins;
          gameWins[stat.gameId] = stat.wins;
        }
        result.add({
          'id': p.id,
          'name': p.name,
          'avatar': p.avatar,
          'lastSeen': p.lastSeen.toIso8601String(),
          'stats': {'totalWins': totalWins, 'gameWins': gameWins},
        });
      }
      return Response.ok(
        jsonEncode(result),
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
        },
      );
    });

    // API: List achievements of a player
    router.get('/api/players/<playerId>/achievements', (Request request, String playerId) async {
      final query = db.select(db.achievements)..where((t) => t.playerId.equals(playerId));
      final achievements = await query.get();
      return Response.ok(
          jsonEncode(achievements.map((a) => {
            'gameId': a.gameId,
            'achievementId': a.achievementId,
            'unlockedAt': a.unlockedAt.toIso8601String(),
          }).toList()),
          headers: {'content-type': 'application/json'});
    });

    // Dynamic Game Assets Serving
    router.get('/games/<gameId>/<file|.*>',
        (Request request, String gameId, String file) async {
      final root = shellAssetsPath.replaceAll('shell_assets', '');
      final gameDir = Directory(p.join(root, 'game_assets', gameId)).absolute;
      final filePath = (file.isEmpty || file == '/') ? 'index.html' : file;
      final fileToServe = File(p.join(gameDir.path, filePath)).absolute;
      
      if (!fileToServe.path.startsWith(gameDir.path)) {
        return Response.forbidden('Access denied');
      }
      
      if (!await fileToServe.exists()) {
        await AssetExtractor.extractGameAssets(gameId);
      }
      if (!await fileToServe.exists()) {
        return Response.notFound('File not found');
      }
      final bytes = await fileToServe.readAsBytes();
      
      String contentType = 'text/html';
      if (filePath.endsWith('.css')) {
        contentType = 'text/css';
      } else if (filePath.endsWith('.js')) {
        contentType = 'application/javascript';
      } else if (filePath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filePath.endsWith('.json')) {
        contentType = 'application/json';
      } else if (filePath.endsWith('.wav')) {
        contentType = 'audio/wav';
      } else if (filePath.endsWith('.mp3')) {
        contentType = 'audio/mpeg';
      } else if (filePath.endsWith('.ogg')) {
        contentType = 'audio/ogg';
      }
      
      final headers = <String, String>{
        'content-type': contentType,
      };
      if (filePath.endsWith('.wav') || filePath.endsWith('.mp3') || filePath.endsWith('.ogg') || filePath.endsWith('.png')) {
        headers['cache-control'] = 'public, max-age=31536000, immutable';
      }
      return Response.ok(bytes, headers: headers);
    });

    // WebSocket Handler
    final wsHandler =
        webSocketHandler((WebSocketChannel channel, dynamic protocol) {
      if (!_isRunning || KernelManager().status == 'STOPPING') {
        channel.sink.close();
        return;
      }
      final connectionId = _uuid.v4();
      connectionManager.addConnection(connectionId, channel);

      _statsController.add({
        'log': 'WS_CONNECTION: $connectionId',
        'activeConnections': connectionManager.identifiedCount,
      });

      channel.stream.listen(
        (message) async {
          try {
            final data = jsonDecode(message as String);
            final String type = data['type'];
            final dynamic payload = data['payload'];
            await _router.route(connectionId, type, payload, this);
          } catch (e, stack) {
            _log.severe('Error processing WS message: $e', e, stack);
            final conn = connectionManager.getConnection(connectionId);
            conn?.send('system.error', 'Invalid message format: $e');
          }
        },
        onDone: () {
          _handleDisconnect(connectionId);
        },
        onError: (e) {
          _log.warning('WS error for $connectionId: $e');
          _handleDisconnect(connectionId);
        },
      );
    }, pingInterval: pingInterval);

    router.get('/ws', wsHandler);

    router.get('/api/lobby/status', (Request request) async {
      final rooms = roomData.values.map((r) => r.toJson()).toList();
      return Response.ok(jsonEncode(rooms),
          headers: {'content-type': 'application/json'});
    });

    final staticHandler =
        createStaticHandler(shellAssetsPath, defaultDocument: 'index.html');

    final cascade = Cascade().add(router.call).add(staticHandler);

    final handler =
        const Pipeline().addMiddleware(logRequests()).addHandler(cascade.handler);

    try {
      _server = await io.serve(handler, '0.0.0.0', KernelManager.serverPort);
      _isRunning = true;
      _statsController.add({
        'status': 'running',
        'log': 'SERVER_STARTED on 0.0.0.0:${KernelManager.serverPort}',
        'address': _server!.address.address,
        'port': _server!.port,
        'bind': '0.0.0.0:${KernelManager.serverPort}',
      });
    } catch (e) {
      _isRunning = false;
      _statsController.add({
        'status': 'error',
        'log': 'SERVER_FAILED: $e',
        'error': e.toString(),
      });
      rethrow;
    }
  }

  Future<void> stop() async {
    // Dispose all game engines
    for (final engine in activeEngines.values) {
      try {
        engine.dispose();
      } catch (e) {
        _log.warning('Error disposing engine: $e');
      }
    }
    activeEngines.clear();
    roomData.clear();

    // Cancel all cleanup timers
    for (final timer in _cleanupTimers.values) {
      try {
        timer.cancel();
      } catch (e) {
        _log.warning('Error cancelling timer: $e');
      }
    }
    _cleanupTimers.clear();

    // Close all active connections
    try {
      connectionManager.closeAll();
    } catch (e) {
      _log.warning('Error closing connections: $e');
    }

    // Close HTTP Server first so it stops accepting requests
    try {
      if (_server != null) {
        await _server!.close(force: true);
        _server = null;
      }
    } catch (e) {
      _log.warning('Error closing HTTP server: $e');
    }


    _isRunning = false;
    _statsController.add({'status': 'stopped', 'log': 'SERVER_STOPPED'});
  }

  // --- Disconnect Handling ---

  void _handleDisconnect(String connectionId) {
    final connection = connectionManager.getConnection(connectionId);
    if (connection != null &&
        connection.roomId != null &&
        connection.player != null) {
      final roomId = connection.roomId!;
      final room = roomData[roomId];
      final roomCode = room?.code ?? '';
      final engine = activeEngines[roomId];
      logSystemEvent('PLAYER_DISCONNECTED: player=${connection.player!.name} (${connection.player!.id}), roomCode=$roomCode, connectionId=$connectionId');
      
      engine?.playerLeft(connection.player!);

      connectionManager.removeConnection(connectionId);

      if (room != null && room.hostId == connection.player!.id) {
        final nextOnlinePlayer = room.players.firstWhere(
          (p) => p.id != connection.player!.id && connectionManager.isPlayerOnline(p.id, roomId),
          orElse: () => models.Player(id: '', name: '', avatar: ''),
        );
        if (nextOnlinePlayer.id.isNotEmpty) {
          final updatedRoom = room.copyWith(hostId: nextOnlinePlayer.id);
          roomData[roomId] = updatedRoom;
          roomService.updateHost(roomId, nextOnlinePlayer.id);
          connectionManager.broadcastToRoom(roomId, 'room.update', updatedRoom.toJson());
          logSystemEvent('HOST_TRANSFERRED: host of roomCode=$roomCode transferred to ${nextOnlinePlayer.name} because previous host disconnected.');
        }
      }

      final remaining = connectionManager.getActiveConnectionsCount(roomId);
      if (remaining == 0) {
        logSystemEvent('LAST_PLAYER_DISCONNECTED: roomCode=$roomCode has 0 active players. Starting 60s cleanup timer.');
        _cleanupTimers[roomId]?.cancel();
        _cleanupTimers[roomId] = Timer(const Duration(seconds: 60), () async {
          _cleanupTimers.remove(roomId);
          final currentRemaining = connectionManager.getActiveConnectionsCount(roomId);
          if (currentRemaining == 0) {
            logSystemEvent('CLEANUP_TIMER_EXPIRED: roomCode=$roomCode. Destroying room.');
            await RoomLifecycle.destroyRoom(roomId, this);
          }
        });
      }
    } else {
      connectionManager.removeConnection(connectionId);
      logSystemEvent('WS_CLOSED: connectionId=$connectionId');
    }
    
    // Broadcast updated player count to admin dashboard
    _statsController.add({'activeConnections': connectionManager.identifiedCount});
  }

  // --- Recovery ---

  Future<void> _recoverRooms() async {
    try {
      final activeDbRooms = await (db.select(db.rooms)
            ..where(
                (t) => t.status.equals(models.RoomStatus.active.index)))
          .get();

      for (var dbRoom in activeDbRooms) {
        final manifest = pluginManager.getManifest(dbRoom.gameId);
        if (manifest != null) {
          final players = (jsonDecode(dbRoom.playersJson) as List)
              .map((p) => models.Player.fromJson(p as Map<String, dynamic>))
              .toList();
          final room = models.Room(
            id: dbRoom.id,
            code: dbRoom.code,
            game: manifest,
            players: players,
            spectators: [],
            hostId: dbRoom.hostId,
            status: models.RoomStatus.active,
            settings: jsonDecode(dbRoom.settingsJson) as Map<String, dynamic>,
            createdAt: dbRoom.createdAt,
          );
          roomData[room.id] = room;

          final engine = GameEngineFactory.createEngine(
            manifest: manifest,
            roomId: room.id,
            ctx: this,
            interceptWins: false,
          );
          await engine.load(await pluginManager.getEngineCode(manifest.id));
          engine.init(room.settings, room.players);

          if (dbRoom.publicGameStateJson != null && dbRoom.publicGameStateJson!.isNotEmpty) {
            try {
              final stateMap = jsonDecode(dbRoom.publicGameStateJson!) as Map<String, dynamic>;
              engine.restoreState(stateMap);
              logSystemEvent('RECOVER_STATE_SUCCESS: roomCode=${room.code}');
            } catch (e) {
              logSystemEvent('RECOVER_STATE_FAILED: roomCode=${room.code}, error=$e. Falling back to event replay.');
              await _replayEventsForRecovery(engine, room.id, players);
            }
          } else {
            await _replayEventsForRecovery(engine, room.id, players);
          }

          activeEngines[room.id] = engine;
          _statsController
              .add({'log': 'Recovered Room: ${room.code}'});
        }
      }
    } catch (e) {
      _statsController.add({'log': 'Recovery failed: $e'});
    }
  }

  Future<void> _replayEventsForRecovery(JsEngine engine, String roomId, List<models.Player> players) async {
    final eventsQuery = db.select(db.eventLog)
      ..where((t) => t.roomId.equals(roomId))
      ..orderBy([
        (t) => drift.OrderingTerm(expression: t.timestamp)
      ]);

    final events = await eventsQuery.get();

    for (var event in events) {
      final payload = jsonDecode(event.payloadJson) as Map<String, dynamic>;
      final eventPlayerId = payload['_playerId'] as String?;
      final recoveryPlayer = eventPlayerId != null
          ? players.firstWhere(
              (p) => p.id == eventPlayerId,
              orElse: () => models.Player(id: eventPlayerId, name: 'Recovered', avatar: 'bot'),
            )
          : players.isNotEmpty
              ? players.first
              : models.Player(id: 'recovery', name: 'System', avatar: 'bot');
      engine.handleAction(recoveryPlayer, event.type, payload);
    }
  }

  void evictRoom(String roomId) {
    final engine = activeEngines.remove(roomId);
    if (engine != null) {
      _log.info('Disposing JsEngine for evicted room $roomId');
      engine.dispose();
    }
    roomData.remove(roomId);
    _cleanupTimers.remove(roomId)?.cancel();
    connectionManager.evictRoom(roomId);
    _statsController.add({'activeRooms': roomData.length});
  }

  void dispose() {
    for (final engine in activeEngines.values) {
      engine.dispose();
    }
    _statsController.close();
  }
}

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
import '../rooms/room_service.dart';
import '../database/database.dart';
import '../shared/models.dart' as models;
import 'asset_extractor.dart';
import '../plugins/js_engine.dart';
import '../plugins/plugin_manager.dart';

final _log = Logger('KernelRuntime');

class KernelRuntime {
  final PluginManager pluginManager;
  final AppDatabase db;
  final RoomService roomService;
  final ConnectionManager connectionManager = ConnectionManager();
  final Map<String, JsEngine> activeEngines = {};
  final Map<String, models.Room> roomData = {};
  final Uuid _uuid = const Uuid();

  HttpServer? _server;
  bool _isRunning = false;
  bool get isRunning => _isRunning;

  final StreamController<Map<String, dynamic>> _statsController =
      StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get statsStream => _statsController.stream;

  KernelRuntime({
    required this.pluginManager,
    required this.db,
    required this.roomService,
  });

  Future<void> start(String shellAssetsPath) async {
    if (_isRunning) return;

    _statsController.add({'log': 'SERVER_STARTING', 'status': 'starting'});

    // Scan for game plugins
    await pluginManager.scanPlugins();
    _statsController.add({
      'log': 'PLUGINS_LOADED: ${pluginManager.availableGames.length} games found'
    });

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
      final gamePath = p.join(root, 'game_assets', gameId);
      final fileToServe = File(p.join(gamePath, 'index.html'));
      if (!await fileToServe.exists()) {
        return Response.notFound('Game assets not found');
      }
      final bytes = await fileToServe.readAsBytes();
      return Response.ok(bytes, headers: {'content-type': 'text/html'});
    });

    // WebSocket Handler
    final wsHandler =
        webSocketHandler((WebSocketChannel channel, dynamic protocol) {
      final connectionId = _uuid.v4();
      connectionManager.addConnection(connectionId, channel);

      _statsController.add({
        'log': 'WS_CONNECTION: $connectionId',
        'activeConnections': connectionManager.activeCount,
      });

      channel.stream.listen(
        (message) async {
          try {
            final data = jsonDecode(message as String);
            final String type = data['type'];
            final dynamic payload = data['payload'];
            await _handleMessage(connectionId, type, payload);
          } catch (e) {
            _log.warning('Error processing WS message: $e');
            final conn = connectionManager.getConnection(connectionId);
            conn?.send('system.error', 'Invalid message format');
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
    });

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
      _server = await io.serve(handler, '0.0.0.0', 8080);
      _isRunning = true;
      _statsController.add({
        'status': 'running',
        'log': 'SERVER_STARTED on 0.0.0.0:8080',
        'address': _server!.address.address,
        'port': _server!.port,
        'bind': '0.0.0.0:8080',
      });
    } catch (e) {
      _statsController.add({
        'status': 'error',
        'log': 'SERVER_FAILED: $e',
        'error': e.toString(),
      });
    }
  }

  Future<void> stop() async {
    // Dispose all game engines
    for (final engine in activeEngines.values) {
      engine.dispose();
    }
    activeEngines.clear();
    roomData.clear();

    await _server?.close(force: true);
    _server = null;
    _isRunning = false;
    _statsController.add({'status': 'stopped', 'log': 'SERVER_STOPPED'});
  }

  // --- Message Handling ---

  Future<void> _handleMessage(
      String connectionId, String type, dynamic payload) async {
    final connection = connectionManager.getConnection(connectionId);
    if (connection == null) return;

    switch (type) {
      case 'player.identify':
        final player = models.Player(
          id: payload['id'] ?? _uuid.v4(),
          name: payload['name'],
          avatar: payload['avatar'] ?? 'default',
        );
        connection.player = player;
        connection.send('player.identified', player.toJson());
        break;

      case 'room.create':
        if (connection.player == null) return;
        final manifest = pluginManager.getManifest(payload['gameId']);
        if (manifest == null) {
          connection.send('system.error', 'Game not found');
          return;
        }

        // Enforce max players at creation (min 1 = the host)
        await AssetExtractor.extractGameAssets(manifest.id);

        final room = await roomService.createRoom(
            manifest, connection.player!, payload['settings'] ?? {});
        if (room != null) {
          connection.roomId = room.id;
          roomData[room.id] = room;
          connection.send('room.update', room.toJson());

          final code = await pluginManager.getEngineCode(manifest.id);
          final engine = JsEngine(
            manifest: manifest,
            onPublicState: (state) {
              final currentRoom = roomData[room.id];
              if (currentRoom != null) {
                roomData[room.id] = currentRoom.copyWith(publicGameState: state);
              }
              roomService.updatePublicState(room.id, state);
              connectionManager.broadcastToRoom(
                  room.id, 'game.public_state', state);
            },
            onPrivateState: (pid, state) =>
                connectionManager.sendPrivate(pid, 'game.private_state', state),
            onAchievement: (pid, aid) async {
              try {
                await db.into(db.achievements).insert(AchievementsCompanion.insert(
                  playerId: pid,
                  gameId: manifest.id,
                  achievementId: aid,
                  unlockedAt: DateTime.now(),
                ));
                connectionManager.broadcastToRoom(room.id, 'game.achievement_unlocked', {
                  'playerId': pid,
                  'achievementId': aid,
                });
              } catch (_) {}
            },
          );
          await engine.load(code);
          activeEngines[room.id] = engine;

          _statsController.add({
            'log': 'ROOM_CREATED: ${room.code} (${manifest.name})',
          });
        }
        break;

      case 'room.join':
        if (connection.player == null) return;
        final code = payload['code'] as String;
        final roomId = roomData.keys.firstWhere(
          (id) => roomData[id]!.code == code,
          orElse: () => '',
        );

        if (roomId.isNotEmpty) {
          final room = roomData[roomId]!;

          // Enforce maxPlayers
          if (room.players.length >= room.game.maxPlayers) {
            connection.send('system.error', 'Room is full');
            return;
          }

          if (!room.players.any((p) => p.id == connection.player!.id)) {
            room.players.add(connection.player!);
            await roomService.updatePlayers(roomId, room.players);
          }
          connection.roomId = roomId;
          connection.send('room.update', room.toJson());
          connectionManager.broadcastToRoom(
              roomId, 'room.update', room.toJson());

          final engine = activeEngines[roomId];
          engine?.playerJoined(connection.player!);
        } else {
          connection.send('system.error', 'Room not found');
        }
        break;

      case 'game.action':
        if (connection.roomId == null || connection.player == null) return;
        final engine = activeEngines[connection.roomId];
        if (engine == null) return;

        if (payload['type'] == 'START') {
          final roomId = connection.roomId!;
          final room = roomData[roomId];
          if (room != null) {
            final updatedRoom = room.copyWith(status: models.RoomStatus.active);
            roomData[roomId] = updatedRoom;
            engine.init(updatedRoom.settings, updatedRoom.players);
            await roomService.updateStatus(roomId, models.RoomStatus.active);
            connectionManager.broadcastToRoom(
                roomId, 'room.update', updatedRoom.toJson());
          }
        } else if (payload['type'] == 'UNLOCK_ACHIEVEMENT') {
          final aid = payload['data']['achievementId'] as String;
          try {
            await db.into(db.achievements).insert(AchievementsCompanion.insert(
              playerId: connection.player!.id,
              gameId: engine.manifest.id,
              achievementId: aid,
              unlockedAt: DateTime.now(),
            ));
            connectionManager.broadcastToRoom(connection.roomId!, 'game.achievement_unlocked', {
              'playerId': connection.player!.id,
              'achievementId': aid,
            });
          } catch (_) {}
        } else {
          engine.handleAction(
              connection.player!, payload['type'], payload['data'] ?? {});
        }

        await roomService.addEvent(
            connection.roomId!, connection.player!.id, payload['type'], payload['data']);
        break;
    }
  }

  void _handleDisconnect(String connectionId) {
    final connection = connectionManager.getConnection(connectionId);
    if (connection != null &&
        connection.roomId != null &&
        connection.player != null) {
      final engine = activeEngines[connection.roomId!];
      engine?.playerLeft(connection.player!);
    }
    connectionManager.removeConnection(connectionId);
    _statsController.add({
      'log': 'WS_CLOSED: $connectionId',
      'activeConnections': connectionManager.activeCount,
    });
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

          final engine = JsEngine(
            manifest: manifest,
            onPublicState: (state) {
              final currentRoom = roomData[room.id];
              if (currentRoom != null) {
                roomData[room.id] = currentRoom.copyWith(publicGameState: state);
              }
              roomService.updatePublicState(room.id, state);
              connectionManager.broadcastToRoom(
                  room.id, 'game.public_state', state);
            },
            onPrivateState: (pid, state) =>
                connectionManager.sendPrivate(pid, 'game.private_state', state),
            onAchievement: (pid, aid) async {
              try {
                await db.into(db.achievements).insert(AchievementsCompanion.insert(
                  playerId: pid,
                  gameId: manifest.id,
                  achievementId: aid,
                  unlockedAt: DateTime.now(),
                ));
                connectionManager.broadcastToRoom(room.id, 'game.achievement_unlocked', {
                  'playerId': pid,
                  'achievementId': aid,
                });
              } catch (_) {}
            },
          );
          await engine.load(await pluginManager.getEngineCode(manifest.id));
          engine.init(
              room.settings, room.players);

          // Replay events with actual player IDs
          final eventsQuery = db.select(db.eventLog)
            ..where((t) => t.roomId.equals(room.id))
            ..orderBy([
              (t) => drift.OrderingTerm(expression: t.timestamp)
            ]);

          final events = await eventsQuery.get();

          for (var event in events) {
            final payload =
                jsonDecode(event.payloadJson) as Map<String, dynamic>;
            // Find the player who made this action from the stored event
            // For recovery, we use the room's player list
            final eventPlayerId = payload['_playerId'] as String?;
            final recoveryPlayer = eventPlayerId != null
                ? players.firstWhere(
                    (p) => p.id == eventPlayerId,
                    orElse: () => models.Player(
                        id: eventPlayerId, name: 'Recovered', avatar: 'bot'),
                  )
                : players.isNotEmpty
                    ? players.first
                    : models.Player(
                        id: 'recovery', name: 'System', avatar: 'bot');
            engine.handleAction(recoveryPlayer, event.type, payload);
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

  void dispose() {
    for (final engine in activeEngines.values) {
      engine.dispose();
    }
    _statsController.close();
  }
}

import 'package:logging/logging.dart';

import 'message_handler.dart';
import '../game_engine_factory.dart';
import '../../shared/models.dart' as models;
import '../asset_extractor.dart';

// =============================================================================
// Room message handlers
// =============================================================================

/// Handles `room.create` — creates a new room, initialises settings, and
/// boots a JsEngine via [GameEngineFactory].
class RoomCreateHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    if (connection == null || connection.player == null) return;

    final manifest = ctx.pluginManager.getManifest(payload['gameId']);
    if (manifest == null) {
      connection.send('system.error', 'Game not found');
      return;
    }

    await AssetExtractor.extractGameAssets(manifest.id);

    final initialSettings = <String, dynamic>{};
    if (manifest.settingsSchema != null) {
      manifest.settingsSchema!.forEach((key, value) {
        if (value is Map && value.containsKey('default')) {
          initialSettings[key] = value['default'];
        }
      });
    }
    if (payload['settings'] is Map) {
      initialSettings
          .addAll(Map<String, dynamic>.from(payload['settings'] as Map));
    }

    final room = await ctx.roomService
        .createRoom(manifest, connection.player!, initialSettings);
    if (room != null) {
      connection.roomId = room.id;
      ctx.roomData[room.id] = room;
      ctx.addStats({'activeRooms': ctx.roomData.length});
      connection.send('room.update', room.toJson());
      ctx.logSystemEvent(
          'ROOM_CREATED: roomCode=${room.code}, game=${manifest.name}, host=${connection.player!.name}');

      final code = await ctx.pluginManager.getEngineCode(manifest.id);
      final engine = GameEngineFactory.createEngine(
        manifest: manifest,
        roomId: room.id,
        ctx: ctx,
      );
      await engine.load(code);
      ctx.activeEngines[room.id] = engine;
    }
  }
}

/// Handles `room.join` — join, rejoin, or spectate an existing room.
class RoomJoinHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    if (connection == null || connection.player == null) return;

    final code = payload['code'] as String;
    final roomId = ctx.roomData.keys.firstWhere(
      (id) => ctx.roomData[id]!.code == code,
      orElse: () => '',
    );

    if (roomId.isEmpty) {
      connection.send('system.error', 'Room not found');
      return;
    }

    var room = ctx.roomData[roomId]!;

    // If current host is offline, transfer host privileges.
    final isHostOnline =
        ctx.connectionManager.isPlayerOnline(room.hostId, roomId);
    if (!isHostOnline) {
      room = room.copyWith(hostId: connection.player!.id);
      ctx.roomData[roomId] = room;
      await ctx.roomService.updateHost(roomId, connection.player!.id);
      ctx.logSystemEvent(
          'HOST_TRANSFERRED: host of roomCode=$code transferred to ${connection.player!.name} because previous host was offline.');
    }

    final isAlreadyInRoom =
        room.players.any((p) => p.id == connection.player!.id);
    final isAlreadySpectating =
        room.spectators.any((p) => p.id == connection.player!.id);

    // Cancel any pending cleanup timers since a player has joined/rejoined.
    if (ctx.cleanupTimers.containsKey(roomId)) {
      ctx.cleanupTimers[roomId]?.cancel();
      ctx.cleanupTimers.remove(roomId);
      ctx.logSystemEvent(
          'CLEANUP_TIMER_CANCELLED: Player joined/rejoined roomCode=$code.');
    }

    if (isAlreadyInRoom) {
      // Reconnect.
      ctx.logSystemEvent(
          'PLAYER_RECONNECTED: roomCode=$code, player=${connection.player!.name} (${connection.player!.id})');
      connection.roomId = roomId;
      connection.send('room.update', room.toJson());
      ctx.connectionManager
          .broadcastToRoom(roomId, 'room.update', room.toJson());
      final engine = ctx.activeEngines[roomId];
      engine?.playerJoined(connection.player!);
    } else if (isAlreadySpectating) {
      // Spectator reconnect.
      ctx.logSystemEvent(
          'SPECTATOR_RECONNECTED: roomCode=$code, player=${connection.player!.name} (${connection.player!.id})');
      connection.roomId = roomId;
      connection.send('room.update', room.toJson());
      ctx.connectionManager
          .broadcastToRoom(roomId, 'room.update', room.toJson());
    } else if (room.status == models.RoomStatus.active) {
      // Join as spectator mid-game.
      room.spectators.add(connection.player!);
      ctx.logSystemEvent(
          'PLAYER_JOINED_AS_SPECTATOR: roomCode=$code, player=${connection.player!.name} (${connection.player!.id})');
      connection.roomId = roomId;
      connection.send('room.update', room.toJson());
      ctx.connectionManager
          .broadcastToRoom(roomId, 'room.update', room.toJson());
    } else {
      // Normal player join.
      if (room.players.length >= room.game.maxPlayers) {
        connection.send('system.error', 'Room is full');
        return;
      }
      room.players.add(connection.player!);
      await ctx.roomService.updatePlayers(roomId, room.players);
      ctx.logSystemEvent(
          'PLAYER_JOINED_ROOM: roomCode=$code, player=${connection.player!.name} (${connection.player!.id})');
      connection.roomId = roomId;
      connection.send('room.update', room.toJson());
      ctx.connectionManager
          .broadcastToRoom(roomId, 'room.update', room.toJson());
      final engine = ctx.activeEngines[roomId];
      engine?.playerJoined(connection.player!);
    }
  }
}

/// Handles `room.update_settings` — host updates room settings.
class RoomUpdateSettingsHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    if (connection == null) return;
    if (connection.roomId == null || connection.player == null) return;

    final roomId = connection.roomId!;
    final room = ctx.roomData[roomId];
    if (room != null && connection.player!.id == room.hostId) {
      final settings =
          Map<String, dynamic>.from(payload['settings'] as Map? ?? {});
      final updatedRoom = room.copyWith(settings: settings);
      ctx.roomData[roomId] = updatedRoom;
      await ctx.roomService.updateSettings(roomId, settings);
      ctx.connectionManager
          .broadcastToRoom(roomId, 'room.update', updatedRoom.toJson());

      final engine = ctx.activeEngines[roomId];
      engine?.settingsUpdated(settings);
    }
  }
}

/// Handles `room.change_game` — host switches the game while keeping the room.
class RoomChangeGameHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    if (connection == null) return;
    if (connection.roomId == null || connection.player == null) return;

    final roomId = connection.roomId!;
    final room = ctx.roomData[roomId];
    if (room == null || connection.player!.id != room.hostId) return;

    final gameId = payload['gameId'] as String;
    final manifest = ctx.pluginManager.getManifest(gameId);
    if (manifest == null) return;

    await AssetExtractor.extractGameAssets(manifest.id);

    // Build default settings for the new game.
    final newSettings = <String, dynamic>{};
    if (manifest.settingsSchema != null) {
      manifest.settingsSchema!.forEach((key, value) {
        if (value is Map && value.containsKey('default')) {
          newSettings[key] = value['default'];
        }
      });
    }

    // Retain the room-wide leaderboard.
    if (room.settings.containsKey('_leaderboard')) {
      newSettings['_leaderboard'] = room.settings['_leaderboard'];
    }

    // Merge spectators back into players.
    final allPlayers = [...room.players, ...room.spectators];

    // Dispose old engine.
    final oldEngine = ctx.activeEngines.remove(roomId);
    oldEngine?.dispose();

    final updatedRoom = room.copyWith(
      players: allPlayers,
      spectators: [],
      game: manifest,
      settings: newSettings,
      publicGameState: null,
    );
    ctx.roomData[roomId] = updatedRoom;

    await ctx.roomService.updatePlayers(roomId, allPlayers);
    await ctx.roomService.updateGame(roomId, manifest, newSettings);
    await ctx.roomService.updatePublicState(roomId, {});

    final code = await ctx.pluginManager.getEngineCode(manifest.id);
    ctx.logSystemEvent(
        'ROOM_GAME_CHANGED: roomCode=${room.code}, game=${manifest.name}');

    final newEngine = GameEngineFactory.createEngine(
      manifest: manifest,
      roomId: roomId,
      ctx: ctx,
    );
    await newEngine.load(code);
    ctx.activeEngines[roomId] = newEngine;

    ctx.connectionManager
        .broadcastToRoom(roomId, 'room.update', updatedRoom.toJson());
  }
}

/// Handles `room.reset` — host resets the current game back to the lobby.
class RoomResetHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    if (connection == null) return;
    if (connection.roomId == null || connection.player == null) return;

    final roomId = connection.roomId!;
    final room = ctx.roomData[roomId];
    if (room == null || connection.player!.id != room.hostId) return;

    // Merge spectators back into players.
    final allPlayers = [...room.players, ...room.spectators];

    // Dispose old engine.
    final oldEngine = ctx.activeEngines.remove(roomId);
    oldEngine?.dispose();

    final updatedRoom = room.copyWith(
      players: allPlayers,
      spectators: [],
      status: models.RoomStatus.waiting,
      publicGameState: null,
    );
    ctx.roomData[roomId] = updatedRoom;

    await ctx.roomService.updatePlayers(roomId, allPlayers);
    await ctx.roomService.updateStatus(roomId, models.RoomStatus.waiting);
    await ctx.roomService.updatePublicState(roomId, {});

    final code = await ctx.pluginManager.getEngineCode(room.game.id);
    ctx.logSystemEvent('ROOM_RESET: roomCode=${room.code}');

    final newEngine = GameEngineFactory.createEngine(
      manifest: room.game,
      roomId: roomId,
      ctx: ctx,
    );
    await newEngine.load(code);
    ctx.activeEngines[roomId] = newEngine;

    ctx.connectionManager
        .broadcastToRoom(roomId, 'room.update', updatedRoom.toJson());
  }
}

/// Handles `room.leave` — player explicitly leaves the room.
class RoomLeaveHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    if (connection == null) return;
    if (connection.roomId == null || connection.player == null) return;

    final roomId = connection.roomId!;
    await RoomLifecycle.handlePlayerLeaveRoom(roomId, connection.player!, ctx);
    connection.roomId = null;
    connection.send('room.update', null);
  }
}

// =============================================================================
// Shared room lifecycle helpers
// =============================================================================

/// Static helpers for room lifecycle operations that are called from both
/// message handlers and from [KernelRuntime._handleDisconnect].
class RoomLifecycle {
  static final _log = Logger('RoomLifecycle');

  /// Removes [player] from the room, notifies the engine, handles
  /// host transfer, win-on-abandonment, and room destruction when empty.
  static Future<void> handlePlayerLeaveRoom(
      String roomId, models.Player player, KernelContext ctx) async {
    final room = ctx.roomData[roomId];
    if (room == null) return;

    final wasPlayer = room.players.any((p) => p.id == player.id);
    room.players.removeWhere((p) => p.id == player.id);
    room.spectators.removeWhere((p) => p.id == player.id);

    final engine = ctx.activeEngines[roomId];
    if (engine != null && wasPlayer) {
      engine.playerLeft(player);
    }

    if (room.players.isEmpty) {
      ctx.cleanupTimers[roomId]?.cancel();
      ctx.cleanupTimers.remove(roomId);
      await destroyRoom(roomId, ctx);
    } else {
      var updatedRoom = room.copyWith(
        players: room.players,
        spectators: room.spectators,
      );

      // Transfer host if the leaving player was the host.
      if (room.hostId == player.id) {
        final newHost = room.players.first;
        updatedRoom = updatedRoom.copyWith(hostId: newHost.id);
        await ctx.roomService.updateHost(roomId, newHost.id);
      }

      // Win-on-abandonment: if an active game has only 1 player left.
      if (room.status == models.RoomStatus.active &&
          room.players.length == 1) {
        final remainingPlayer = room.players.first;
        final settings = Map<String, dynamic>.from(room.settings);
        final winOnAbandonment = settings['winOnAbandonment'] ?? true;

        if (winOnAbandonment) {
          final leaderboard =
              Map<String, dynamic>.from(settings['_leaderboard'] ?? {});

          final currentWins = leaderboard[remainingPlayer.id] is Map
              ? (leaderboard[remainingPlayer.id]['wins'] ?? 0)
              : (leaderboard[remainingPlayer.id] ?? 0);

          leaderboard[remainingPlayer.id] = {
            'name': remainingPlayer.name,
            'wins': currentWins + 1,
          };
          settings['_leaderboard'] = leaderboard;

          final activeEngine = ctx.activeEngines.remove(roomId);
          activeEngine?.dispose();

          updatedRoom = updatedRoom.copyWith(
            status: models.RoomStatus.waiting,
            settings: settings,
            publicGameState: null,
          );

          await ctx.roomService.updateSettings(roomId, settings);
          await ctx.roomService
              .updateStatus(roomId, models.RoomStatus.waiting);
          await ctx.roomService.updatePublicState(roomId, {});
          ctx.logSystemEvent(
              'SINGLE_PLAYER_LEFT: Only ${remainingPlayer.name} is left. Awarded win. Room returned to lobby.');

          // Record win globally in DB (fire-and-forget).
          GameEngineFactory.recordPlayerWin(
              ctx, room.game.id, remainingPlayer.id, remainingPlayer.name);
        } else {
          ctx.logSystemEvent(
              'SINGLE_PLAYER_LEFT: Only ${remainingPlayer.name} is left, but winOnAbandonment is disabled.');
        }
      }

      ctx.roomData[roomId] = updatedRoom;
      await ctx.roomService.updatePlayers(roomId, updatedRoom.players);
      ctx.connectionManager
          .broadcastToRoom(roomId, 'room.update', updatedRoom.toJson());
    }
  }

  /// Disposes the engine, removes the room from memory, and marks it
  /// as abandoned in the database.
  static Future<void> destroyRoom(String roomId, KernelContext ctx) async {
    final engine = ctx.activeEngines.remove(roomId);
    if (engine != null) {
      _log.info('Disposing JsEngine for room $roomId');
      engine.dispose();
    }
    final room = ctx.roomData.remove(roomId);
    if (room != null) {
      _log.info('Destroying room ${room.code}');
      await ctx.roomService.updateStatus(roomId, models.RoomStatus.abandoned);
    }
    ctx.addStats({'activeRooms': ctx.roomData.length});
  }
}

import 'package:drift/drift.dart' as drift;

import 'message_handler.dart';
import '../../database/database.dart';
import '../../shared/models.dart' as models;

/// Handles the `player.identify` WebSocket message.
///
/// Resolves player identity (new or returning), validates session tokens,
/// upserts the player row in SQLite, fetches global win stats, and
/// updates in-room profiles when the player is already in a room.
class PlayerHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    if (connection == null) return;

    final String playerId = payload['id'] ?? '';
    final String sessionToken = payload['sessionToken'] ?? '';

    // Reject if this player ID is already active on another connection.
    if (playerId.isNotEmpty &&
        ctx.connectionManager
            .isPlayerOnlineGlobally(playerId, connectionId)) {
      connection.send('system.error',
          'This Player ID is already active on another device.');
      return;
    }

    String? name = payload['name'];
    String avatar = payload['avatar'] ?? 'default';

    // If no name supplied, try to look up existing profile.
    if (name == null || name.trim().isEmpty) {
      if (playerId.isEmpty) {
        connection.send('system.error', 'Username is required.');
        return;
      }
      final dbPlayer = await (ctx.db.select(ctx.db.players)
            ..where((t) => t.id.equals(playerId)))
          .getSingleOrNull();
      if (dbPlayer == null) {
        connection.send(
            'system.error', 'No profile found for this Player ID.');
        return;
      }
      name = dbPlayer.name;
      avatar = dbPlayer.avatar;
    }

    // Resolve player ID and session token.
    final String resolvedPlayerId;
    final String resolvedSessionToken;

    if (playerId.isNotEmpty) {
      final dbPlayer = await (ctx.db.select(ctx.db.players)
            ..where((t) => t.id.equals(playerId)))
          .getSingleOrNull();
      if (dbPlayer != null) {
        if (dbPlayer.sessionToken != null &&
            dbPlayer.sessionToken != sessionToken) {
          connection.send(
              'system.error', 'Invalid session token. Access denied.');
          return;
        }
        resolvedPlayerId = playerId;
        resolvedSessionToken = dbPlayer.sessionToken ?? ctx.uuid.v4();
      } else {
        resolvedPlayerId = playerId;
        resolvedSessionToken =
            sessionToken.isNotEmpty ? sessionToken : ctx.uuid.v4();
      }
    } else {
      resolvedPlayerId = ctx.uuid.v4();
      resolvedSessionToken = ctx.uuid.v4();
    }

    // Upsert player row.
    await ctx.db
        .into(ctx.db.players)
        .insertOnConflictUpdate(PlayersCompanion.insert(
          id: resolvedPlayerId,
          name: name,
          avatar: avatar,
          sessionToken: drift.Value(resolvedSessionToken),
          lastSeen: DateTime.now(),
        ));

    final player = models.Player(
      id: resolvedPlayerId,
      name: name,
      avatar: avatar,
    );
    connection.player = player;
    ctx.connectionManager.removeStaleConnections(player.id, connectionId);

    // Fetch global wins for this player.
    final statsList = await (ctx.db.select(ctx.db.gameStats)
          ..where((t) => t.playerId.equals(player.id)))
        .get();
    int totalWins = 0;
    final gameWins = <String, int>{};
    for (var stat in statsList) {
      totalWins += stat.wins;
      gameWins[stat.gameId] = stat.wins;
    }
    final statsPayload = {
      'totalWins': totalWins,
      'gameWins': gameWins,
    };

    final playerJson = Map<String, dynamic>.from(player.toJson());
    playerJson['stats'] = statsPayload;
    playerJson['sessionToken'] = resolvedSessionToken;

    connection.send('player.identified', playerJson);
    ctx.logSystemEvent(
        'PLAYER_IDENTIFIED: connectionId=$connectionId, player=${player.name} (${player.id})');
    // Update admin dashboard player count to only show identified players.
    ctx.addStats(
        {'activeConnections': ctx.connectionManager.identifiedCount});

    // If the player was already in a room, update their profile there too.
    if (connection.roomId != null) {
      final roomId = connection.roomId!;
      final room = ctx.roomData[roomId];
      if (room != null) {
        bool changed = false;
        for (int i = 0; i < room.players.length; i++) {
          if (room.players[i].id == player.id) {
            room.players[i] = player;
            changed = true;
          }
        }
        for (int i = 0; i < room.spectators.length; i++) {
          if (room.spectators[i].id == player.id) {
            room.spectators[i] = player;
            changed = true;
          }
        }
        if (changed) {
          await ctx.roomService.updatePlayers(roomId, room.players);
          ctx.connectionManager
              .broadcastToRoom(roomId, 'room.update', room.toJson());
          final engine = ctx.activeEngines[roomId];
          engine?.playerJoined(player);
        }
      }
    }
  }
}

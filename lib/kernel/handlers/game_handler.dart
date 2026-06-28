import 'message_handler.dart';
import '../../database/database.dart';
import 'package:drift/drift.dart';
import '../../shared/models.dart' as models;
import '../game_engine_factory.dart';

/// Handles `game.action` — START, UNLOCK_ACHIEVEMENT, and generic game actions.
class GameActionHandler extends MessageHandler {
  @override
  Future<void> handle(
      String connectionId, dynamic payload, KernelContext ctx) async {
    final connection = ctx.connectionManager.getConnection(connectionId);
    if (connection == null) return;
    if (connection.roomId == null || connection.player == null) return;

    var engine = ctx.activeEngines[connection.roomId];

    if (payload['type'] == 'START') {
      final roomId = connection.roomId!;
      final room = ctx.roomData[roomId];
      if (room != null) {
        if (room.players.length < room.game.minPlayers) {
          connection.send(
              'system.error', 'Not enough players to start the game.');
          return;
        }
        if (engine == null) {
          final code = await ctx.pluginManager.getEngineCode(room.game.id);
          engine = GameEngineFactory.createEngine(
            manifest: room.game,
            roomId: roomId,
            ctx: ctx,
          );
          await engine.load(code);
          ctx.activeEngines[roomId] = engine;
        }
        final updatedRoom =
            room.copyWith(status: models.RoomStatus.active);
        ctx.roomData[roomId] = updatedRoom;
        engine.init(updatedRoom.settings, updatedRoom.players);
        await ctx.roomService
            .updateStatus(roomId, models.RoomStatus.active);

        // Retrieve latest room from cache which contains the updated
        // publicGameState (may have been set by engine.init → onPublicState).
        final finalRoom = ctx.roomData[roomId] ?? updatedRoom;
        ctx.connectionManager
            .broadcastToRoom(roomId, 'room.update', finalRoom.toJson());
      }
    } else if (engine == null) {
      return;
    } else if (payload['type'] == 'UNLOCK_ACHIEVEMENT') {
      final aid = payload['data']['achievementId'] as String;
      try {
        await ctx.db
            .into(ctx.db.achievements)
            .insert(AchievementsCompanion.insert(
              playerId: connection.player!.id,
              gameId: engine.manifest.id,
              achievementId: aid,
              unlockedAt: DateTime.now(),
            ), mode: InsertMode.insertOrIgnore);
        ctx.connectionManager.broadcastToRoom(
            connection.roomId!, 'game.achievement_unlocked', {
          'playerId': connection.player!.id,
          'achievementId': aid,
        });
      } catch (_) {}
    } else {
      engine.handleAction(
          connection.player!, payload['type'], payload['data'] ?? {});
    }

    await ctx.roomService.addEvent(connection.roomId!,
        connection.player!.id, payload['type'], payload['data']);
  }
}

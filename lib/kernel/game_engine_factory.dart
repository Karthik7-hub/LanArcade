import 'package:drift/drift.dart' as drift;
import 'package:logging/logging.dart';

import 'handlers/message_handler.dart';
import '../database/database.dart';
import '../shared/models.dart' as models;
import '../plugins/js_engine.dart';

final _log = Logger('GameEngineFactory');

/// Consolidates the 4 duplicate JsEngine construction sites
/// (room.create, room.change_game, room.reset, _recoverRooms) into a
/// single factory with standardised callbacks.
class GameEngineFactory {
  /// Creates a [JsEngine] wired to [ctx] for room [roomId].
  ///
  /// When [interceptWins] is true (the default) the `onPublicState` callback
  /// detects game-finish events and records the winner in the leaderboard and
  /// global stats table.  Set to `false` for recovery engines where the win
  /// was already persisted before the crash.
  static JsEngine createEngine({
    required models.GameManifest manifest,
    required String roomId,
    required KernelContext ctx,
    bool interceptWins = true,
  }) {
    return JsEngine(
      manifest: manifest,
      onLog: ctx.logSystemEvent,
      onPublicState: (state) {
        final currentRoom = ctx.roomData[roomId];
        if (currentRoom != null) {
          if (interceptWins) {
            final finalState = Map<String, dynamic>.from(state);
            if (finalState['status'] == 'finished' &&
                finalState['winner'] != null) {
              final winnerId = finalState['winner'] as String;
              final oldState = currentRoom.publicGameState;
              final wasFinished =
                  oldState != null && oldState['status'] == 'finished';
              if (!wasFinished) {
                // Fire-and-forget — callback is void, not Future<void>.
                _handleGameFinished(ctx, currentRoom, finalState, winnerId);
                return;
              }
            }
          }
          ctx.roomData[roomId] =
              currentRoom.copyWith(publicGameState: state);
        }

        // Throttled DB write (at most once every 5 seconds per room).
        final now = DateTime.now();
        final lastWrite = ctx.lastStateWrite[roomId];
        if (lastWrite == null ||
            now.difference(lastWrite).inSeconds >= 5) {
          ctx.lastStateWrite[roomId] = now;
          ctx.roomService.updatePublicState(roomId, state);
        }

        ctx.connectionManager
            .broadcastToRoom(roomId, 'game.public_state', state);
      },
      onPrivateState: (pid, state) =>
          ctx.connectionManager
              .sendPrivate(pid, 'game.private_state', state),
      onAchievement: (pid, aid) async {
        try {
          await ctx.db
              .into(ctx.db.achievements)
              .insert(AchievementsCompanion.insert(
                playerId: pid,
                gameId: manifest.id,
                achievementId: aid,
                unlockedAt: DateTime.now(),
              ));
          ctx.connectionManager
              .broadcastToRoom(roomId, 'game.achievement_unlocked', {
            'playerId': pid,
            'achievementId': aid,
          });
        } catch (_) {}
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Helpers – shared by the factory callback and by RoomLifecycle
  // ---------------------------------------------------------------------------

  /// Updates the room leaderboard, records the global win, and broadcasts the
  /// final game state.  Previously duplicated across room.create (inline),
  /// room.change_game, and room.reset — now a single source of truth.
  static Future<void> _handleGameFinished(
    KernelContext ctx,
    models.Room room,
    Map<String, dynamic> finalState,
    String winnerId,
  ) async {
    final settings = Map<String, dynamic>.from(room.settings);
    final leaderboard =
        Map<String, dynamic>.from(settings['_leaderboard'] ?? {});

    final winnerPlayer = room.players.firstWhere(
      (p) => p.id == winnerId,
      orElse: () =>
          models.Player(id: winnerId, name: 'Unknown', avatar: 'default'),
    );

    final currentWins = leaderboard[winnerId] is Map
        ? (leaderboard[winnerId]['wins'] ?? 0)
        : (leaderboard[winnerId] ?? 0);

    leaderboard[winnerId] = {
      'name': winnerPlayer.name,
      'wins': currentWins + 1,
    };
    settings['_leaderboard'] = leaderboard;

    await ctx.roomService.updateSettings(room.id, settings);

    final updatedRoom = room.copyWith(
      settings: settings,
      publicGameState: finalState,
    );
    ctx.roomData[room.id] = updatedRoom;

    await recordPlayerWin(ctx, room.game.id, winnerId, winnerPlayer.name);

    ctx.connectionManager
        .broadcastToRoom(room.id, 'room.update', updatedRoom.toJson());
    await ctx.roomService.updatePublicState(room.id, finalState);
    ctx.connectionManager
        .broadcastToRoom(room.id, 'game.public_state', finalState);
  }

  /// Records a player win in the global stats database.
  ///
  /// Called from [_handleGameFinished] and from
  /// `RoomLifecycle.handlePlayerLeaveRoom` (win-on-abandonment).
  static Future<void> recordPlayerWin(
    KernelContext ctx,
    String gameId,
    String playerId,
    String name,
  ) async {
    try {
      await ctx.db.transaction(() async {
        final existingPlayer = await (ctx.db.select(ctx.db.players)
              ..where((t) => t.id.equals(playerId)))
            .getSingleOrNull();

        if (existingPlayer == null) {
          await ctx.db
              .into(ctx.db.players)
              .insertOnConflictUpdate(PlayersCompanion.insert(
                id: playerId,
                name: name,
                avatar: 'default',
                lastSeen: DateTime.now(),
              ));
        } else {
          await ctx.db
              .into(ctx.db.players)
              .insertOnConflictUpdate(PlayersCompanion.insert(
                id: playerId,
                name: name,
                avatar: existingPlayer.avatar,
                lastSeen: DateTime.now(),
              ));
        }

        final existingStats = await (ctx.db.select(ctx.db.gameStats)
              ..where((t) =>
                  t.playerId.equals(playerId) & t.gameId.equals(gameId)))
            .getSingleOrNull();

        if (existingStats == null) {
          await ctx.db
              .into(ctx.db.gameStats)
              .insert(GameStatsCompanion.insert(
                playerId: playerId,
                gameId: gameId,
                wins: const drift.Value(1),
                losses: const drift.Value(0),
              ));
        } else {
          await ctx.db
              .into(ctx.db.gameStats)
              .insertOnConflictUpdate(GameStatsCompanion.insert(
                playerId: playerId,
                gameId: gameId,
                wins: drift.Value(existingStats.wins + 1),
                losses: drift.Value(existingStats.losses),
                totalPoints: drift.Value(existingStats.totalPoints),
                customStatsJson: drift.Value(existingStats.customStatsJson),
              ));
        }
      });

      ctx.logSystemEvent(
          'RECORD_WIN: Player $name ($playerId) won in $gameId. Total wins incremented globally.');
    } catch (e) {
      _log.warning('Failed to record player win in DB: $e');
    }
  }
}

import 'dart:convert';
import 'dart:math';
import '../database/database.dart';
import '../shared/models.dart' as models;
import 'package:drift/drift.dart';

class RoomService {
  final AppDatabase db;
  final Random _random = Random.secure();

  RoomService(this.db);

  Future<models.Room?> createRoom(models.GameManifest game, models.Player host, Map<String, dynamic> settings) async {
    final roomId = DateTime.now().millisecondsSinceEpoch.toString();
    final code = _generateCode();
    
    final room = models.Room(
      id: roomId,
      code: code,
      game: game,
      players: [host],
      spectators: [],
      hostId: host.id,
      status: models.RoomStatus.waiting,
      settings: settings,
      createdAt: DateTime.now(),
    );

    await db.into(db.rooms).insert(RoomsCompanion.insert(
      id: roomId,
      code: code,
      gameId: game.id,
      hostId: host.id,
      playersJson: jsonEncode([host.toJson()]),
      status: models.RoomStatus.waiting,
      settingsJson: jsonEncode(settings),
      createdAt: DateTime.now(),
      lastActiveAt: Value(DateTime.now()),
    ));

    return room;
  }

  Future<void> addEvent(String roomId, String playerId, String type, dynamic payload) async {
    // Store player ID with the event for recovery
    final payloadMap = payload is Map<String, dynamic> 
        ? Map<String, dynamic>.from(payload)
        : <String, dynamic>{};
    payloadMap['_playerId'] = playerId;
    
    await db.into(db.eventLog).insert(EventLogCompanion.insert(
      roomId: roomId,
      type: type,
      payloadJson: jsonEncode(payloadMap),
      timestamp: DateTime.now(),
    ));

    // Update last active
    await (db.update(db.rooms)..where((t) => t.id.equals(roomId))).write(
      RoomsCompanion(lastActiveAt: Value(DateTime.now())),
    );
  }

  Future<void> updatePublicState(String roomId, Map<String, dynamic> state) async {
    await (db.update(db.rooms)..where((t) => t.id.equals(roomId))).write(
      RoomsCompanion(
        publicGameStateJson: Value(jsonEncode(state)),
        lastActiveAt: Value(DateTime.now()),
      ),
    );
  }

  Future<void> updatePlayers(String roomId, List<models.Player> players) async {
    await (db.update(db.rooms)..where((t) => t.id.equals(roomId))).write(
      RoomsCompanion(
        playersJson: Value(jsonEncode(players.map((p) => p.toJson()).toList())),
        lastActiveAt: Value(DateTime.now()),
      ),
    );
  }

  Future<void> updateStatus(String roomId, models.RoomStatus status) async {
    await (db.update(db.rooms)..where((t) => t.id.equals(roomId))).write(
      RoomsCompanion(
        status: Value(status),
        lastActiveAt: Value(DateTime.now()),
      ),
    );
  }

  Future<void> updateSettings(String roomId, Map<String, dynamic> settings) async {
    await (db.update(db.rooms)..where((t) => t.id.equals(roomId))).write(
      RoomsCompanion(
        settingsJson: Value(jsonEncode(settings)),
        lastActiveAt: Value(DateTime.now()),
      ),
    );
  }

  Future<void> updateHost(String roomId, String hostId) async {
    await (db.update(db.rooms)..where((t) => t.id.equals(roomId))).write(
      RoomsCompanion(
        hostId: Value(hostId),
        lastActiveAt: Value(DateTime.now()),
      ),
    );
  }


  /// Generate a unique 4-digit room code using secure random.
  String _generateCode() {
    return (1000 + _random.nextInt(9000)).toString();
  }
}

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:drift/drift.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

import 'asset_extractor.dart';
import 'kernel_runtime.dart';
import 'foreground_service_manager.dart';
import 'cleanup_settings.dart';
import '../database/database.dart';
import '../rooms/room_service.dart';
import '../plugins/plugin_manager.dart';
import '../shared/models.dart';

class KernelManager {
  KernelRuntime? _runtime;
  AppDatabase? _db;
  Timer? _autoCleanupTimer;

  final _statsController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get statsStream => _statsController.stream;

  final List<String> _logHistory = [];
  List<String> get logHistory => List.unmodifiable(_logHistory);

  String _status = 'OFFLINE';
  String get status => _status;

  void _addStats(Map<String, dynamic> event) {
    if (event.containsKey('status')) {
      _status = event['status'].toString().toUpperCase();
    }
    if (event.containsKey('log')) {
      final logText = event['log'].toString();
      _logHistory.insert(0, logText);
      if (_logHistory.length > 100) {
        _logHistory.removeLast();
      }
    }
    _statsController.add(event);
  }

  AppDatabase get db {
    _db ??= AppDatabase();
    return _db!;
  }

  List<GameManifest> get availableGames => _runtime?.pluginManager.availableGames ?? [];

  int get activeRoomsCount => _runtime?.roomData.length ?? 0;

  Map<String, Room> get activeRooms => _runtime?.roomData ?? {};

  Future<void> start() async {
    if (_runtime?.isRunning == true) return;

    _addStats({'log': 'SERVER_START_REQUESTED', 'status': 'starting'});

    try {
      _addStats({'log': 'EXTRACTING_ASSETS...'});
      final webPath = await AssetExtractor.extractShellAssets();
      _addStats({'log': 'ASSETS_READY: $webPath'});

      final roomService = RoomService(db);
      final pluginManager = PluginManager();

      _runtime = KernelRuntime(
        pluginManager: pluginManager,
        db: db,
        roomService: roomService,
      );

      // Forward stats from the runtime
      _runtime!.statsStream.listen((event) {
        _addStats(event);
      });

      await _runtime!.start(webPath);
      await ForegroundServiceManager.start();
      
      // Start background auto cleanup timer
      _startAutoCleanupTimer();
    } catch (e) {
      _addStats({
        'log': 'SERVER_FAILED: $e',
        'status': 'error',
        'error': e.toString(),
      });
    }
  }

  Future<void> stop() async {
    _autoCleanupTimer?.cancel();
    _autoCleanupTimer = null;
    
    if (_runtime != null) {
      await _runtime!.stop();
      _runtime!.dispose();
      _runtime = null;
      await ForegroundServiceManager.stop();
    }
    await _db?.close();
    _db = null;
    _addStats({'status': 'stopped', 'log': 'SERVER_STOPPED'});
  }

  Future<void> dispose() async {
    await stop();
    _statsController.close();
    await _db?.close();
    _db = null;
  }

  // --- Storage & Cleanup Center Service Methods ---

  Future<Map<String, dynamic>> getStorageStats() async {
    try {
      final completedCount = await (db.select(db.rooms)
            ..where((t) => t.status.equals(RoomStatus.finished.index)))
          .get()
          .then((res) => res.length);
          
      final abandonedCount = await (db.select(db.rooms)
            ..where((t) => t.status.equals(RoomStatus.abandoned.index)))
          .get()
          .then((res) => res.length);
          
      final reconnectCount = await (db.select(db.rooms)
            ..where((t) => t.status.equals(RoomStatus.active.index) | t.status.equals(RoomStatus.waiting.index)))
          .get()
          .then((res) => res.length);

      final eventsCount = await db.select(db.eventLog).get().then((res) => res.length);

      final dbFolder = await getApplicationDocumentsDirectory();
      final file = File(p.join(dbFolder.path, 'arcade.sqlite'));
      double sizeMb = 0;
      if (await file.exists()) {
        sizeMb = (await file.length()) / (1024 * 1024);
      }

      return {
        'completedGames': completedCount,
        'abandonedRooms': abandonedCount,
        'reconnectStates': reconnectCount,
        'eventLogs': eventsCount,
        'storageUsedMb': double.parse(sizeMb.toStringAsFixed(2)),
      };
    } catch (e) {
      return {
        'completedGames': 0,
        'abandonedRooms': 0,
        'reconnectStates': 0,
        'eventLogs': 0,
        'storageUsedMb': 0.0,
      };
    }
  }

  Future<void> clearCompletedGames() async {
    final rooms = await (db.select(db.rooms)..where((t) => t.status.equals(RoomStatus.finished.index))).get();
    for (var room in rooms) {
      await _deleteRoomData(room.id);
    }
  }

  Future<void> clearAbandonedRooms() async {
    final rooms = await (db.select(db.rooms)..where((t) => t.status.equals(RoomStatus.abandoned.index))).get();
    for (var room in rooms) {
      await _deleteRoomData(room.id);
    }
  }

  Future<void> clearExpiredReconnectStates() async {
    final rooms = await (db.select(db.rooms)..where((t) => t.status.equals(RoomStatus.active.index) | t.status.equals(RoomStatus.waiting.index))).get();
    for (var room in rooms) {
      if (_runtime == null || !_runtime!.activeEngines.containsKey(room.id)) {
        await _deleteRoomData(room.id);
      }
    }
  }

  Future<void> clearEventLogs() async {
    await db.delete(db.eventLog).go();
  }

  Future<void> fullCleanup() async {
    await db.delete(db.eventLog).go();
    await db.delete(db.rooms).go();
  }

  Future<void> _deleteRoomData(String roomId) async {
    await (db.delete(db.eventLog)..where((t) => t.roomId.equals(roomId))).go();
    await (db.delete(db.rooms)..where((t) => t.id.equals(roomId))).go();
  }

  Future<List<RoomStorageDetail>> getRoomStorageDetails() async {
    final dbRooms = await db.select(db.rooms).get();
    final list = <RoomStorageDetail>[];
    for (final r in dbRooms) {
      int playersCount = 0;
      try {
        final List players = jsonDecode(r.playersJson) as List;
        playersCount = players.length;
      } catch (_) {}
      
      final isActiveInMemory = _runtime?.activeEngines.containsKey(r.id) ?? false;
      
      list.add(RoomStorageDetail(
        id: r.id,
        code: r.code,
        gameId: r.gameId,
        hostId: r.hostId,
        playersCount: playersCount,
        status: r.status,
        createdAt: r.createdAt,
        lastActiveAt: r.lastActiveAt,
        isActiveInMemory: isActiveInMemory,
      ));
    }
    // Sort by last active or created at (newest first)
    list.sort((a, b) {
      final tA = a.lastActiveAt ?? a.createdAt;
      final tB = b.lastActiveAt ?? b.createdAt;
      return tB.compareTo(tA);
    });
    return list;
  }

  Future<void> deleteRoom(String roomId) async {
    if (_runtime != null) {
      _runtime!.evictRoom(roomId);
    }
    await _deleteRoomData(roomId);
  }

  // --- Automatic Cleanup Configurations & Timer Loops ---

  void _startAutoCleanupTimer() {
    _autoCleanupTimer?.cancel();
    // Run cleanup once every hour
    _autoCleanupTimer = Timer.periodic(const Duration(hours: 1), (_) {
      _runAutoCleanup();
    });
    // Trigger immediately on server start
    _runAutoCleanup();
  }

  Future<void> _runAutoCleanup() async {
    final settings = await CleanupSettings.load();
    if (!settings.autoCleanup) return;
    
    final now = DateTime.now();

    // 1. Clean Completed Games (status == RoomStatus.finished)
    if (settings.completedMatchesDays > 0) {
      final cutoff = now.subtract(Duration(days: settings.completedMatchesDays));
      final rooms = await (db.select(db.rooms)
            ..where((t) => t.status.equals(RoomStatus.finished.index) & t.lastActiveAt.isSmallerThanValue(cutoff)))
          .get();
      for (var room in rooms) {
        await _deleteRoomData(room.id);
      }
    }

    // 2. Clean Abandoned Rooms (status == RoomStatus.abandoned)
    if (settings.abandonedRoomsHours > 0) {
      final cutoff = now.subtract(Duration(hours: settings.abandonedRoomsHours));
      final rooms = await (db.select(db.rooms)
            ..where((t) => t.status.equals(RoomStatus.abandoned.index) & t.lastActiveAt.isSmallerThanValue(cutoff)))
          .get();
      for (var room in rooms) {
        await _deleteRoomData(room.id);
      }
    }

    // 3. Clean Expired Reconnect States (status == RoomStatus.active or waiting)
    if (settings.reconnectStatesHours > 0) {
      final cutoff = now.subtract(Duration(hours: settings.reconnectStatesHours));
      final rooms = await (db.select(db.rooms)
            ..where((t) => (t.status.equals(RoomStatus.active.index) | t.status.equals(RoomStatus.waiting.index)) & t.lastActiveAt.isSmallerThanValue(cutoff)))
          .get();
      for (var room in rooms) {
        if (_runtime == null || !_runtime!.activeEngines.containsKey(room.id)) {
          await _deleteRoomData(room.id);
        }
      }
    }
  }

  Future<CleanupSettings> getCleanupSettings() => CleanupSettings.load();

  Future<void> saveCleanupSettings(CleanupSettings settings) async {
    await settings.save();
    // Restart timer if running
    if (_runtime?.isRunning == true) {
      _startAutoCleanupTimer();
    }
  }
}

class RoomStorageDetail {
  final String id;
  final String code;
  final String gameId;
  final String hostId;
  final int playersCount;
  final RoomStatus status;
  final DateTime createdAt;
  final DateTime? lastActiveAt;
  final bool isActiveInMemory;

  RoomStorageDetail({
    required this.id,
    required this.code,
    required this.gameId,
    required this.hostId,
    required this.playersCount,
    required this.status,
    required this.createdAt,
    this.lastActiveAt,
    required this.isActiveInMemory,
  });
}



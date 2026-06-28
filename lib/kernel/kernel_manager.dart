import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:drift/drift.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
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
import '../discovery/discovery_service.dart';

class KernelManager {
  static const int serverPort = 8080;

  static final KernelManager _instance = KernelManager._internal();
  factory KernelManager() => _instance;
  KernelManager._internal();

  KernelRuntime? _runtime;
  AppDatabase? _db;
  Timer? _autoCleanupTimer;

  final _statsController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get statsStream => _statsController.stream;

  final List<String> _logHistory = [];
  List<String> get logHistory => List.unmodifiable(_logHistory);

  ServerState _state = ServerState.offline;
  ServerState get state => _state;

  String get status => _state.name.toUpperCase();

  // Resource Ownership flags
  bool _dbOpen = false;
  bool _runtimeStarted = false;
  bool _discoveryStarted = false;
  bool _foregroundServiceStarted = false;
  bool _cleanupTimerStarted = false;

  DateTime? _startupTime;
  DateTime? get startupTime => _startupTime;

  Duration pingInterval = const Duration(seconds: 30);

  void _addStats(Map<String, dynamic> event) {
    if (event.containsKey('status')) {
      final s = event['status'].toString().toLowerCase();
      if (s == 'running') {
        _state = ServerState.running;
      } else if (s == 'stopping') {
        _state = ServerState.stopping;
      } else if (s == 'error') {
        _state = ServerState.error;
      } else if (s == 'stopped') {
        _state = ServerState.offline;
      } else if (s == 'starting') {
        _state = ServerState.starting;
      }
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
    if (_state != ServerState.offline && _state != ServerState.error) return;

    _state = ServerState.starting;
    _addStats({'log': 'SERVER_START_REQUESTED', 'status': 'starting'});

    try {
      _addStats({'log': 'EXTRACTING_ASSETS...'});
      final webPath = await AssetExtractor.extractShellAssets().timeout(const Duration(seconds: 5));
      _addStats({'log': 'ASSETS_READY: $webPath'});

      final roomService = RoomService(db);
      final pluginManager = PluginManager();

      _runtime = KernelRuntime(
        pluginManager: pluginManager,
        db: db,
        roomService: roomService,
      );

      _runtime!.statsStream.listen((event) {
        _addStats(event);
      });

      // 1. Touch Database to verify connection
      await db.customSelect('SELECT 1').getSingle().timeout(const Duration(seconds: 5));
      _dbOpen = true;

      // 2. Start HTTP and WebSocket server
      await _runtime!.start(webPath, pingInterval: pingInterval).timeout(const Duration(seconds: 5));
      _runtimeStarted = true;

      // 3. Start Discovery Service (mDNS)
      final discovery = DiscoveryService();
      await discovery.start("Main Arcade", serverPort).timeout(const Duration(seconds: 5));
      _discoveryStarted = true;

      // 4. Start Foreground Service (acquires native locks)
      await ForegroundServiceManager.start().timeout(const Duration(seconds: 5));
      _foregroundServiceStarted = true;
      
      // 5. Start background auto cleanup timer
      _startAutoCleanupTimer();
      _cleanupTimerStarted = true;

      _startupTime = DateTime.now();
      _state = ServerState.running;
      _addStats({'status': 'running', 'log': 'SERVER_ONLINE'});
    } catch (e) {
      _addStats({
        'log': 'SERVER_FAILED: $e',
        'status': 'error',
        'error': e.toString(),
      });
      await stop();
      _state = ServerState.error;
    }
  }

  Future<void> stop() async {
    final oldState = _state;
    _state = ServerState.stopping;
    _addStats({'status': 'stopping', 'log': 'SERVER_SHUTTING_DOWN'});

    // Graceful Shutdown Sequence: broadcast alert, wait, then clean up.
    if (oldState == ServerState.running && _runtimeStarted && _runtime != null) {
      try {
        _runtime!.logSystemEvent('GRACEFUL_SHUTDOWN_INITIATED: Notifying clients...');
        _runtime!.connectionManager.broadcastAll('system.shutdown', 'Host server is shutting down');
        await Future.delayed(const Duration(seconds: 3));
      } catch (e) {
        debugPrint("Graceful shutdown error: $e");
      }
    }

    if (_cleanupTimerStarted) {
      _autoCleanupTimer?.cancel();
      _autoCleanupTimer = null;
      _cleanupTimerStarted = false;
    }

    if (_discoveryStarted) {
      try {
        await DiscoveryService().stop().timeout(const Duration(seconds: 2));
      } catch (e) {
        debugPrint("Discovery stop timed out: $e");
      }
      _discoveryStarted = false;
    }
    
    if (_runtimeStarted && _runtime != null) {
      try {
        await _runtime!.stop().timeout(const Duration(seconds: 2));
        _runtime!.dispose();
      } catch (e) {
        debugPrint("Runtime stop timed out: $e");
      }
      _runtime = null;
      _runtimeStarted = false;
    }

    if (_foregroundServiceStarted) {
      try {
        await ForegroundServiceManager.stop().timeout(const Duration(seconds: 2));
      } catch (e) {
        debugPrint("Foreground service stop timed out: $e");
      }
      _foregroundServiceStarted = false;
    }

    if (_dbOpen && _db != null) {
      try {
        await _db!.close().timeout(const Duration(seconds: 2));
      } catch (e) {
        debugPrint("Database close timed out: $e");
      }
      _db = null;
      _dbOpen = false;
    }

    _startupTime = null;
    _state = ServerState.offline;
    _addStats({'status': 'stopped', 'log': 'SERVER_STOPPED'});
  }

  Future<void> dispose() async {
    await stop();
    _statsController.close();
  }

  // Native Diagnostics Helper Method
  Future<Map<String, dynamic>> getNativeServiceStatus() async {
    if (!_foregroundServiceStarted) {
      return {
        'serviceRunning': false,
        'wakeLock': false,
        'wifiLock': false,
        'multicastLock': false,
      };
    }
    try {
      const channel = MethodChannel('com.lanarcade.lan_arcade/foreground_service');
      final result = await channel.invokeMethod('getServiceStatus');
      if (result is Map) {
        return Map<String, dynamic>.from(result);
      }
    } catch (e) {
      debugPrint("Failed to get native service status: $e");
    }
    return {
      'serviceRunning': false,
      'wakeLock': false,
      'wifiLock': false,
      'multicastLock': false,
    };
  }

  // Dart Server Diagnostics Helper Method
  Map<String, dynamic> getDiagnosticsInfo() {
    final uptime = _startupTime != null ? DateTime.now().difference(_startupTime!) : Duration.zero;
    final wsCount = _runtime?.connectionManager.activeCount ?? 0;
    final identifiedCount = _runtime?.connectionManager.identifiedCount ?? 0;
    
    return {
      'uptime': uptime,
      'openSockets': wsCount,
      'identifiedPlayers': identifiedCount,
      'activeRooms': activeRoomsCount,
      'mDNSState': _discoveryStarted ? 'Registered' : 'Inactive',
    };
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



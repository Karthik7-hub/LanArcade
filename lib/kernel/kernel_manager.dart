import 'dart:async';
import 'asset_extractor.dart';
import 'kernel_runtime.dart';
import '../database/database.dart';
import '../rooms/room_service.dart';
import '../plugins/plugin_manager.dart';

import '../shared/models.dart';

class KernelManager {
  KernelRuntime? _runtime;

  final _statsController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get statsStream => _statsController.stream;

  List<GameManifest> get availableGames => _runtime?.pluginManager.availableGames ?? [];

  Future<void> start() async {
    if (_runtime?.isRunning == true) return;

    _statsController.add({'log': 'SERVER_START_REQUESTED', 'status': 'starting'});

    try {
      _statsController.add({'log': 'EXTRACTING_ASSETS...'});
      final webPath = await AssetExtractor.extractShellAssets();
      _statsController.add({'log': 'ASSETS_READY: $webPath'});

      final db = AppDatabase();
      final roomService = RoomService(db);
      final pluginManager = PluginManager();

      _runtime = KernelRuntime(
        pluginManager: pluginManager,
        db: db,
        roomService: roomService,
      );

      // Forward stats from the runtime
      _runtime!.statsStream.listen((event) {
        _statsController.add(event);
      });

      await _runtime!.start(webPath);
    } catch (e) {
      _statsController.add({
        'log': 'SERVER_FAILED: $e',
        'status': 'error',
        'error': e.toString(),
      });
    }
  }

  Future<void> stop() async {
    if (_runtime != null) {
      await _runtime!.stop();
      _runtime!.dispose();
      _runtime = null;
    }
    _statsController.add({'status': 'stopped', 'log': 'SERVER_STOPPED'});
  }
}

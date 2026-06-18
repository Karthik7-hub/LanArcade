import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:logging/logging.dart';
import '../shared/models.dart';

class PluginManager {
  static final _log = Logger('PluginManager');
  final Map<String, GameManifest> _registry = {};
  final String manifestsDir = 'assets/manifests';
  final String enginesDir = 'assets/engines';

  Future<void> scanPlugins() async {
    try {
      final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      final assets = manifest.listAssets();
      
      final manifestFiles = assets
          .where((key) => key.startsWith(manifestsDir) && key.endsWith('.json'))
          .toList();

      _registry.clear();
      for (final path in manifestFiles) {
        try {
          final content = await rootBundle.loadString(path);
          final gameManifest = GameManifest.fromJson(json.decode(content));
          if (!gameManifest.sdkVersion.startsWith('1.')) {
            _log.warning('Skipped plugin ${gameManifest.name}: SDK version ${gameManifest.sdkVersion} is incompatible with host SDK 1.0.0');
            continue;
          }
          _registry[gameManifest.id] = gameManifest;
          _log.info('Loaded plugin: ${gameManifest.name} (${gameManifest.id})');
        } catch (e) {
          _log.severe('Failed to load plugin at $path: $e');
        }
      }
    } catch (e) {
      _log.severe('Error scanning plugins: $e');
    }
  }

  List<GameManifest> get availableGames => _registry.values.toList();
  GameManifest? getManifest(String id) => _registry[id];

  Future<String> getEngineCode(String gameId) async {
    final path = '$enginesDir/$gameId.js';
    return await rootBundle.loadString(path);
  }
}

import 'dart:io';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:logging/logging.dart';

class AssetExtractor {
  static final _log = Logger('AssetExtractor');
  static const String _version = '1.0.0+5';

  static Future<String> getExtractedRoot() async {
    final docsDir = await getApplicationDocumentsDirectory();
    return docsDir.path;
  }

  static Future<String> extractShellAssets() async {
    final root = await getExtractedRoot();
    final targetDir = Directory(p.join(root, 'shell_assets'));
    
    if (!await targetDir.exists()) {
      await targetDir.create(recursive: true);
    }

    final versionFile = File(p.join(targetDir.path, 'version.txt'));
    if (!kDebugMode && await versionFile.exists()) {
      final currentVersion = await versionFile.readAsString();
      if (currentVersion.trim() == _version) {
        _log.info('Shell assets already up-to-date at version $_version. Skipping extraction.');
        return targetDir.path;
      }
    }

    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    final assets = manifest.listAssets();
    
    final shellAssets = assets.where((key) => key.startsWith('assets/shell/')).toList();

    for (final assetPath in shellAssets) {
      try {
        final relativePath = assetPath.replaceFirst('assets/shell/', '');
        final file = File(p.join(targetDir.path, relativePath));
        await file.parent.create(recursive: true);
        final data = await rootBundle.load(assetPath);
        final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
        await file.writeAsBytes(bytes, flush: true);
      } catch (e) {
        // Skip assets that fail to extract (e.g., corrupted)
        continue;
      }
    }

    try {
      await versionFile.writeAsString(_version, flush: true);
    } catch (e) {
      _log.warning('Failed to write version file: $e');
    }

    return targetDir.path;
  }

  static Future<String> extractGameAssets(String gameId) async {
    final root = await getExtractedRoot();
    final targetDir = Directory(p.join(root, 'game_assets', gameId));
    
    if (!await targetDir.exists()) {
      await targetDir.create(recursive: true);
    }

    final versionFile = File(p.join(targetDir.path, 'version.txt'));
    if (!kDebugMode && await versionFile.exists()) {
      final currentVersion = await versionFile.readAsString();
      if (currentVersion.trim() == _version) {
        _log.info('Game assets for $gameId already up-to-date at version $_version. Skipping extraction.');
        return targetDir.path;
      }
    }

    try {
      final assetPath = 'assets/clients/$gameId.html';
      final file = File(p.join(targetDir.path, 'index.html'));
      final data = await rootBundle.load(assetPath);
      final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      await file.writeAsBytes(bytes, flush: true);
      _log.info('Extracted client assets for $gameId to ${file.path}');

      // Extract sub-assets starting with "assets/clients/sfx/${gameId}_" recursively
      final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
      final assets = manifest.listAssets();
      final prefix = 'assets/clients/sfx/${gameId}_';
      final subAssets = assets.where((key) => key.startsWith(prefix)).toList();

      for (final assetKey in subAssets) {
        final relativePath = assetKey.replaceFirst(prefix, '');
        final targetFile = File(p.join(targetDir.path, relativePath));
        await targetFile.parent.create(recursive: true);
        final fileData = await rootBundle.load(assetKey);
        final fileBytes = fileData.buffer.asUint8List(fileData.offsetInBytes, fileData.lengthInBytes);
        await targetFile.writeAsBytes(fileBytes, flush: true);
        _log.info('Extracted sub-asset for $gameId: $relativePath to ${targetFile.path}');
      }

      try {
        await versionFile.writeAsString(_version, flush: true);
      } catch (e) {
        _log.warning('Failed to write version file for game $gameId: $e');
      }
    } catch (e) {
      _log.severe('Failed to extract client assets for $gameId: $e');
    }

    return targetDir.path;
  }
}

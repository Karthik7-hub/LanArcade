import 'dart:io';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

class AssetExtractor {
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

    return targetDir.path;
  }

  static Future<String> extractGameAssets(String gameId) async {
    final root = await getExtractedRoot();
    final targetDir = Directory(p.join(root, 'game_assets', gameId));
    
    if (!await targetDir.exists()) {
      await targetDir.create(recursive: true);
    }

    try {
      final assetPath = 'assets/clients/$gameId.html';
      final file = File(p.join(targetDir.path, 'index.html'));
      final data = await rootBundle.load(assetPath);
      final bytes = data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
      await file.writeAsBytes(bytes, flush: true);
      print('Extracted client assets for $gameId to ${file.path}');
    } catch (e) {
      print('Failed to extract client assets for $gameId: $e');
    }

    return targetDir.path;
  }
}

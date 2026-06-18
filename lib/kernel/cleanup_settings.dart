import 'dart:convert';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

class CleanupSettings {
  final bool autoCleanup;
  final int completedMatchesDays;
  final int abandonedRoomsHours;
  final int reconnectStatesHours;

  CleanupSettings({
    required this.autoCleanup,
    required this.completedMatchesDays,
    required this.abandonedRoomsHours,
    required this.reconnectStatesHours,
  });

  factory CleanupSettings.defaultSettings() {
    return CleanupSettings(
      autoCleanup: true,
      completedMatchesDays: 7, // 7 days
      abandonedRoomsHours: 24, // 24 hours
      reconnectStatesHours: 48, // 48 hours
    );
  }

  factory CleanupSettings.fromJson(Map<String, dynamic> json) {
    return CleanupSettings(
      autoCleanup: json['autoCleanup'] ?? true,
      completedMatchesDays: json['completedMatchesDays'] ?? 7,
      abandonedRoomsHours: json['abandonedRoomsHours'] ?? 24,
      reconnectStatesHours: json['reconnectStatesHours'] ?? 48,
    );
  }

  Map<String, dynamic> toJson() => {
        'autoCleanup': autoCleanup,
        'completedMatchesDays': completedMatchesDays,
        'abandonedRoomsHours': abandonedRoomsHours,
        'reconnectStatesHours': reconnectStatesHours,
      };

  static Future<File> _getSettingsFile() async {
    final docsDir = await getApplicationDocumentsDirectory();
    return File(p.join(docsDir.path, 'cleanup_settings.json'));
  }

  static Future<CleanupSettings> load() async {
    try {
      final file = await _getSettingsFile();
      if (await file.exists()) {
        final content = await file.readAsString();
        final json = jsonDecode(content);
        return CleanupSettings.fromJson(json);
      }
    } catch (_) {}
    return CleanupSettings.defaultSettings();
  }

  Future<void> save() async {
    try {
      final file = await _getSettingsFile();
      await file.writeAsString(jsonEncode(toJson()), flush: true);
    } catch (_) {}
  }
}

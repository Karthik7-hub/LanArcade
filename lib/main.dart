import 'package:flutter/material.dart';
import 'package:logging/logging.dart';
import 'ui/splash_screen.dart';
import 'ui/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Configure logging to print to console
  Logger.root.level = Level.ALL;
  Logger.root.onRecord.listen((record) {
    debugPrint('${record.time.toIso8601String()} [${record.loggerName}] ${record.level.name}: ${record.message}');
    if (record.error != null) {
      debugPrint('Error: ${record.error}');
    }
    if (record.stackTrace != null) {
      debugPrint('StackTrace: ${record.stackTrace}');
    }
  });

  runApp(const ArcadeApp());
}

class ArcadeApp extends StatelessWidget {
  const ArcadeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Lan Arcade Platform',
      debugShowCheckedModeBanner: false,
      theme: ArcadeTheme.darkTheme,
      home: const SplashScreen(),
    );
  }
}

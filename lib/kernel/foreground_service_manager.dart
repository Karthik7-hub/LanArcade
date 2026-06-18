import 'package:flutter/services.dart';
import 'dart:io';

class ForegroundServiceManager {
  static const _channel = MethodChannel('com.lanarcade.lan_arcade/foreground_service');

  static Future<void> start() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod('startService');
    } catch (e) {
      // Ignore or log error
    }
  }

  static Future<void> stop() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod('stopService');
    } catch (e) {
      // Ignore or log error
    }
  }
}

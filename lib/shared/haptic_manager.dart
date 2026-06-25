import 'package:flutter/services.dart';

class HapticManager {
  static void trigger(String type) {
    try {
      switch (type) {
        case 'light':
        case 'button':
          HapticFeedback.lightImpact();
          break;
        case 'medium':
        case 'notification':
        case 'success':
          HapticFeedback.mediumImpact();
          break;
        case 'heavy':
        case 'error':
          HapticFeedback.heavyImpact();
          break;
        default:
          HapticFeedback.vibrate();
      }
    } catch (e) {
      // Silently catch platform exceptions if haptics aren't supported on this device/emulator
    }
  }
}

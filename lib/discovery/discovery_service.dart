import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:nsd/nsd.dart';
import '../kernel/kernel_manager.dart';

class DiscoveryService {
  static final DiscoveryService _instance = DiscoveryService._internal();
  factory DiscoveryService() => _instance;
  DiscoveryService._internal();

  Registration? _registration;
  String _currentName = "Main Arcade";
  int _currentPort = KernelManager.serverPort;
  bool _isRegistering = false;

  bool get isRegistered => _registration != null;

  Future<void> start(String arcadeName, int port) async {
    if (_registration != null || _isRegistering) return;
    _isRegistering = true;
    _currentName = arcadeName;
    _currentPort = port;
    try {
      await _registerService();
    } finally {
      _isRegistering = false;
    }
  }

  Future<void> _registerService() async {
    try {
      _registration = await register(Service(
        name: _currentName,
        type: '_lanarcade._tcp',
        port: _currentPort,
        txt: {
          'version': utf8.encode('1.0.0'),
        },
      ));
    } catch (e) {
      debugPrint("mDNS Registration failed: $e");
      _registration = null;
      rethrow;
    }
  }

  Future<void> stop() async {
    if (_registration != null) {
      try {
        await unregister(_registration!);
      } catch (e) {
        debugPrint("mDNS Unregistration error (swallowed): $e");
      }
      _registration = null;
    }
  }
}

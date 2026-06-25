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
  int _currentPlayers = 0;
  bool _isRegistering = false;
  bool _pendingUpdate = false;

  Future<void> start(String arcadeName, int port) async {
    _currentName = arcadeName;
    _currentPort = port;
    await _registerService();
  }

  Future<void> updatePlayersCount(int count) async {
    if (_currentPlayers == count) return;
    _currentPlayers = count;
    _pendingUpdate = true;
    await _triggerUpdate();
  }

  Future<void> _triggerUpdate() async {
    if (_isRegistering) return;
    _isRegistering = true;
    while (_pendingUpdate) {
      _pendingUpdate = false;
      await stop();
      await _registerService();
    }
    _isRegistering = false;
  }

  Future<void> _registerService() async {
    try {
      _registration = await register(Service(
        name: _currentName,
        type: '_lanarcade._tcp',
        port: _currentPort,
        txt: {
          'version': utf8.encode('1.0.0'),
          'players': utf8.encode(_currentPlayers.toString()),
        },
      ));
    } catch (e) {
      debugPrint("mDNS Registration failed: $e");
    }
  }

  Future<void> stop() async {
    if (_registration != null) {
      try {
        await unregister(_registration!);
      } catch (e) {
        // MDNS stack unregistration occasionally throws; swallow it to avoid hanging shutdown
      }
      _registration = null;
    }
  }
}

import 'dart:convert';
import 'package:nsd/nsd.dart';

class DiscoveryService {
  Registration? _registration;

  Future<void> start(String arcadeName, int port) async {
    _registration = await register(Service(
      name: arcadeName,
      type: '_lanarcade._tcp',
      port: port,
      txt: {
        'version': utf8.encode('1.0.0'),
        'players': utf8.encode('0'),
      },
    ));
  }


  Future<void> stop() async {
    if (_registration != null) {
      await unregister(_registration!);
      _registration = null;
    }
  }
}

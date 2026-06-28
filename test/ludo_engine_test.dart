// ignore_for_file: avoid_print
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_arcade/plugins/js_engine.dart';
import 'package:lan_arcade/shared/models.dart';

void main() {
  test('Simulate Ludo game initialization and state verification', () async {
    TestWidgetsFlutterBinding.ensureInitialized();

    final manifestFile = File('assets/manifests/ludo.json');
    final manifestJson = jsonDecode(await manifestFile.readAsString());
    final manifest = GameManifest.fromJson(manifestJson);

    final engineFile = File('assets/engines/ludo.js');
    final engineCode = await engineFile.readAsString();

    Map<String, dynamic>? finalPublicState;

    late JsEngine engine;
    try {
      engine = JsEngine(
        manifest: manifest,
        onPublicState: (state) {
          print('--- LUDO PUBLIC STATE BROADCAST ---');
          print(jsonEncode(state));
          finalPublicState = state;
        },
        onPrivateState: (playerId, state) {},
        onAchievement: (playerId, achievementId) {},
      );
    } catch (e) {
      if (e.toString().contains('Failed to load dynamic library') ||
          e.toString().contains('quickjs_c_bridge')) {
        print('Skipping test: quickjs_c_bridge library not available on host platform.');
        return;
      }
      rethrow;
    }

    await engine.load(engineCode);

    final players = [
      Player(id: 'player_red', name: 'Red Player', avatar: 'default', isHost: true),
      Player(id: 'player_green', name: 'Green Player', avatar: 'default', isHost: false),
    ];

    print('Initializing Ludo engine...');
    engine.init({}, players);

    await Future.delayed(const Duration(milliseconds: 500));

    expect(finalPublicState, isNotNull);
    expect(finalPublicState!['status'], equals('active'));
    expect(finalPublicState!['turnOrder'].length, equals(2));
    expect(finalPublicState!['currentTurnIndex'], equals(0));
    
    final tokens = finalPublicState!['tokens'] as Map;
    expect(tokens['player_red'], isNotNull);
    expect(tokens['player_green'], isNotNull);

    final redTokens = tokens['player_red'] as List;
    expect(redTokens.length, equals(4));
    expect(redTokens[0]['step'], equals(-1)); // should be in yard/base
    expect(redTokens[0]['at'], equals('base'));

    engine.dispose();
  });
}

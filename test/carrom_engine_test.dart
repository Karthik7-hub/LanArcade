// ignore_for_file: avoid_print
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_arcade/plugins/js_engine.dart';
import 'package:lan_arcade/shared/models.dart';

void main() {
  test('Simulate Carrom game initialization and state verification', () async {
    TestWidgetsFlutterBinding.ensureInitialized();

    final manifestFile = File('assets/manifests/carrom.json');
    final manifestJson = jsonDecode(await manifestFile.readAsString());
    final manifest = GameManifest.fromJson(manifestJson);

    final engineFile = File('assets/engines/carrom.js');
    final engineCode = await engineFile.readAsString();

    Map<String, dynamic>? finalPublicState;

    late JsEngine engine;
    try {
      engine = JsEngine(
        manifest: manifest,
        onPublicState: (state) {
          print('--- CARROM PUBLIC STATE BROADCAST ---');
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
      Player(id: 'p_red', name: 'Red Shooter', avatar: 'default', isHost: true),
      Player(id: 'p_green', name: 'Green Shooter', avatar: 'default', isHost: false),
    ];

    print('Initializing Carrom engine...');
    engine.init({}, players);

    await Future.delayed(const Duration(milliseconds: 500));

    expect(finalPublicState, isNotNull);
    expect(finalPublicState!['status'], equals('active'));
    expect(finalPublicState!['simulating'], equals(false));

    final coins = finalPublicState!['coins'] as List;
    expect(coins.length, equals(19)); // 9 black + 9 white + 1 queen

    // Center coin should be queen
    final queen = coins.firstWhere((c) => c['type'] == 'queen');
    expect(queen['x'], equals(400));
    expect(queen['y'], equals(400));

    final striker = finalPublicState!['striker'];
    expect(striker, isNotNull);
    expect(striker['active'], equals(true));

    engine.dispose();
  });
}

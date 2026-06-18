// ignore_for_file: avoid_print
import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:lan_arcade/plugins/js_engine.dart';
import 'package:lan_arcade/shared/models.dart';

void main() {
  test('Simulate UNO game initialization and inspect states', () async {
    TestWidgetsFlutterBinding.ensureInitialized();

    // 1. Load UNO manifest
    final manifestFile = File('assets/manifests/uno.json');
    final manifestJson = jsonDecode(await manifestFile.readAsString());
    final manifest = GameManifest.fromJson(manifestJson);

    // 2. Load UNO engine script
    final engineFile = File('assets/engines/uno.js');
    final engineCode = await engineFile.readAsString();

    Map<String, dynamic>? finalPublicState;
    final Map<String, Map<String, dynamic>> finalPrivateStates = {};

    // 3. Create JsEngine
    final engine = JsEngine(
      manifest: manifest,
      onPublicState: (state) {
        print('--- BROADCAST PUBLIC STATE ---');
        print(jsonEncode(state));
        finalPublicState = state;
      },
      onPrivateState: (playerId, state) {
        print('--- SEND PRIVATE STATE to $playerId ---');
        print(jsonEncode(state));
        finalPrivateStates[playerId] = state;
      },
      onAchievement: (playerId, achievementId) {
        print('Achievement unlocked: $playerId - $achievementId');
      },
    );

    // 4. Load code
    await engine.load(engineCode);

    // 5. Initialize with two players
    final players = [
      Player(id: 'p1_id', name: 'Player One', avatar: 'default', isHost: true),
      Player(id: 'p2_id', name: 'Player Two', avatar: 'default', isHost: false),
    ];

    print('Initializing UNO engine...');
    engine.init({}, players);

    // Give asynchronous message queue callbacks a short moment to execute
    await Future.delayed(const Duration(milliseconds: 500));

    expect(finalPublicState, isNotNull);
    expect(finalPublicState!['status'], equals('active'));
    expect(finalPublicState!['currentPlayerId'], isNotNull);
    
    expect(finalPrivateStates['p1_id'], isNotNull);
    expect(finalPrivateStates['p2_id'], isNotNull);

    final p1Hand = finalPrivateStates['p1_id']!['hand'] as List;
    final p2Hand = finalPrivateStates['p2_id']!['hand'] as List;

    print('Player 1 hand size: ${p1Hand.length}');
    print('Player 2 hand size: ${p2Hand.length}');

    expect(p1Hand.length, equals(7));
    expect(p2Hand.length, equals(7));

    engine.dispose();
  });
}

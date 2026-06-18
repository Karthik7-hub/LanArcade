import 'package:flutter_test/flutter_test.dart';
import 'package:lan_arcade/main.dart';

void main() {
  testWidgets('Arcade app smoke test', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ArcadeApp());

    // Verify that the title is present on the splash screen
    expect(find.text('LAN ARCADE'), findsOneWidget);
    expect(find.text('YOUR PORTABLE ARCADE SYSTEM'), findsOneWidget);

    // Pump the 3-second transition timer so it fires and no timers are left pending
    await tester.pump(const Duration(seconds: 3));
    await tester.pumpAndSettle();
  });
}

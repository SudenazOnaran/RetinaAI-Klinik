// Smoke test — uygulamanın temel widget'larının yüklendiğini doğrular.
// API, RevenueCat ve cihaz izinleri bu testlerde mock'lanmaz;
// tüm cihaz bağımlı servisler ayrı unit/widget testlerinde kapsanır.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:retina_ai_app/widgets/medical_disclaimer_banner.dart';

void main() {
  testWidgets('MedicalDisclaimerBanner smoke test', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: MedicalDisclaimerBanner())),
    );
    expect(find.byType(MedicalDisclaimerBanner), findsOneWidget);
    expect(find.byIcon(Icons.info_outline), findsOneWidget);
  });
}

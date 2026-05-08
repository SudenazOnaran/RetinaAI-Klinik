import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:retina_ai_app/widgets/medical_disclaimer_banner.dart';

void main() {
  Widget buildSubject() =>
      const MaterialApp(home: Scaffold(body: MedicalDisclaimerBanner()));

  group('MedicalDisclaimerBanner', () {
    testWidgets('widget ağaçta görünür', (tester) async {
      await tester.pumpWidget(buildSubject());
      expect(find.byType(MedicalDisclaimerBanner), findsOneWidget);
    });

    testWidgets('info_outline ikonu gösterilir', (tester) async {
      await tester.pumpWidget(buildSubject());
      expect(find.byIcon(Icons.info_outline), findsOneWidget);
    });

    testWidgets('yasal uyarı metninin anahtar sözcüklerini içerir', (
      tester,
    ) async {
      await tester.pumpWidget(buildSubject());
      // Metni parçalara bölerek test et (tek Text widget'ında olabilir veya
      // RichText olarak render edilmiş olabilir — finder hem ikisini yakalar)
      expect(
        find.textContaining('sağlık profesyonellerine', findRichText: true),
        findsOneWidget,
      );
      expect(
        find.textContaining('tıbbi tanı yerine geçmez', findRichText: true),
        findsOneWidget,
      );
    });

    testWidgets('Container border ve borderRadius içerir', (tester) async {
      await tester.pumpWidget(buildSubject());
      final container = tester.widget<Container>(find.byType(Container).first);
      final decoration = container.decoration as BoxDecoration;

      expect(decoration.border, isNotNull);
      expect(decoration.borderRadius, isNotNull);
    });
  });
}

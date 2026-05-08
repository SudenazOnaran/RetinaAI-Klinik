import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:retina_ai_app/screens/results_screen.dart';
import 'package:retina_ai_app/data/models/analysis_api_model.dart';

/// ResultsScreen için minimal GoRouter wrapper.
/// GoRouter'a ihtiyaç var: AppBar'daki back butonunda context.go() çağrılıyor.
Widget buildResultsScreen(AnalysisApiModel model) {
  final router = GoRouter(
    initialLocation: '/results',
    routes: [
      GoRoute(
        path: '/results',
        builder: (_, __) => ResultsScreen(analysis: model),
      ),
      GoRoute(
        path: '/home',
        builder: (_, __) => const Scaffold(body: Text('Home')),
      ),
    ],
  );
  return MaterialApp.router(routerConfig: router);
}

AnalysisApiModel _makeModel({
  String aiResult = 'no_dr',
  double confidence = 0.88,
  int? drGradeInt,
  String? heatmapUrl,
  String? doctorNote,
}) {
  return AnalysisApiModel(
    id: 'test-id',
    patientId: 'patient-1',
    aiResult: aiResult,
    confidence: confidence,
    drGradeInt: drGradeInt,
    heatmapUrl: heatmapUrl,
    doctorNote: doctorNote,
    createdAt: DateTime(2026, 5, 7),
  );
}

void main() {
  // GoogleFonts test ortamında font yükleyemez; network çağrısını devre dışı bırak.
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('ResultsScreen — genel yapı', () {
    testWidgets('AppBar "Analiz Sonucu" başlığını gösterir', (tester) async {
      await tester.pumpWidget(buildResultsScreen(_makeModel()));
      await tester.pumpAndSettle();

      expect(find.text('Analiz Sonucu'), findsOneWidget);
    });

    testWidgets('Sağlık uyarısı metni gösterilir', (tester) async {
      await tester.pumpWidget(buildResultsScreen(_makeModel()));
      await tester.pumpAndSettle();

      // ResultsScreen'deki inline disclaimer metni
      expect(
        find.textContaining('kesin tanı yerine geçmez', findRichText: true),
        findsOneWidget,
      );
    });

    testWidgets('"Risk Seviyesi Değerlendirmesi" başlığı gösterilir', (
      tester,
    ) async {
      await tester.pumpWidget(buildResultsScreen(_makeModel()));
      await tester.pumpAndSettle();

      expect(find.text('Risk Seviyesi Değerlendirmesi'), findsOneWidget);
    });
  });

  group('ResultsScreen — risk etiketi (drGradeInt)', () {
    final cases = [
      (grade: 0, expectedLabel: 'YOK'),
      (grade: 1, expectedLabel: 'HAFİF'),
      (grade: 2, expectedLabel: 'ORTA'),
      (grade: 3, expectedLabel: 'YÜKSEK'),
      (grade: 4, expectedLabel: 'ÇOK YÜKSEK'),
    ];

    for (final c in cases) {
      testWidgets('drGradeInt=${c.grade} → "${c.expectedLabel}" etiketi', (
        tester,
      ) async {
        await tester.pumpWidget(
          buildResultsScreen(_makeModel(drGradeInt: c.grade)),
        );
        await tester.pumpAndSettle();

        expect(find.text(c.expectedLabel), findsOneWidget);
      });
    }
  });

  group('ResultsScreen — risk etiketi (aiResult metin fallback)', () {
    testWidgets('aiResult "no_dr" → "YOK" etiketi (drGradeInt null)', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildResultsScreen(_makeModel(aiResult: 'no_dr')),
      );
      await tester.pumpAndSettle();

      expect(find.text('YOK'), findsOneWidget);
    });

    testWidgets('aiResult "moderate" → "ORTA" etiketi (drGradeInt null)', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildResultsScreen(_makeModel(aiResult: 'moderate')),
      );
      await tester.pumpAndSettle();

      // moderate keyword → ORTA risk seviyesi
      expect(find.text('ORTA'), findsOneWidget);
    });
  });

  group('ResultsScreen — güven skoru', () {
    testWidgets('güven yüzdesi görüntülenir', (tester) async {
      await tester.pumpWidget(buildResultsScreen(_makeModel(confidence: 0.92)));
      await tester.pumpAndSettle();

      // "%92" veya "92" metni görünmeli
      expect(find.textContaining('92', findRichText: true), findsWidgets);
    });
  });

  group('ResultsScreen — yüksek risk uyarısı', () {
    testWidgets('drGradeInt>=3 → yüksek risk uyarı banner\'ı gösterilir', (
      tester,
    ) async {
      await tester.pumpWidget(buildResultsScreen(_makeModel(drGradeInt: 3)));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Yüksek risk tespit edildi', findRichText: true),
        findsOneWidget,
      );
    });

    testWidgets('drGradeInt=0 → yüksek risk uyarı banner\'ı gösterilmez', (
      tester,
    ) async {
      await tester.pumpWidget(buildResultsScreen(_makeModel(drGradeInt: 0)));
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Yüksek risk tespit edildi', findRichText: true),
        findsNothing,
      );
    });
  });

  group('ResultsScreen — heatmap', () {
    testWidgets('heatmapUrl null → heatmap bölümü gösterilmez', (tester) async {
      await tester.pumpWidget(buildResultsScreen(_makeModel(heatmapUrl: null)));
      await tester.pumpAndSettle();

      expect(find.text('Isı Haritası (GradCAM)'), findsNothing);
    });

    testWidgets('heatmapUrl dolu → heatmap başlığı gösterilir', (tester) async {
      await tester.pumpWidget(
        buildResultsScreen(
          _makeModel(heatmapUrl: 'https://retina-ai.tech/heatmaps/test.jpg'),
        ),
      );
      // pumpAndSettle kullanma — CachedNetworkImage ağ isteği bekletir.
      // Tek frame pump ile widget ağacı title'ı render eder.
      await tester.pump(Duration.zero);

      // Heatmap başlığı (ResultsScreen'deki gerçek metin)
      expect(find.text('AI Isı Haritası'), findsOneWidget);
    });
  });

  group('ResultsScreen — doktor notu', () {
    testWidgets('doctorNote null → not bölümü gösterilmez', (tester) async {
      await tester.pumpWidget(buildResultsScreen(_makeModel(doctorNote: null)));
      await tester.pumpAndSettle();

      expect(find.text('Doktor Notu'), findsNothing);
    });

    testWidgets('doctorNote dolu → başlık ve içerik gösterilir', (
      tester,
    ) async {
      await tester.pumpWidget(
        buildResultsScreen(
          _makeModel(doctorNote: 'Lazer tedavisi gerekebilir.'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Doktor Notu'), findsOneWidget);
      expect(find.text('Lazer tedavisi gerekebilir.'), findsOneWidget);
    });
  });
}

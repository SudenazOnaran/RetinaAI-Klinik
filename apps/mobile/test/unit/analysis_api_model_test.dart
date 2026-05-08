import 'package:flutter_test/flutter_test.dart';
import 'package:retina_ai_app/data/models/analysis_api_model.dart';

void main() {
  group('AnalysisApiModel.fromJson', () {
    final Map<String, dynamic> minimalJson = {
      'id': 'test-id-123',
      'patientId': 'patient-456',
      'aiResult': 'no_dr',
      'confidence': 0.92,
      'createdAt': '2026-05-07T10:00:00.000Z',
    };

    test('zorunlu alanları doğru parse eder', () {
      final model = AnalysisApiModel.fromJson(minimalJson);

      expect(model.id, equals('test-id-123'));
      expect(model.patientId, equals('patient-456'));
      expect(model.aiResult, equals('no_dr'));
      expect(model.confidence, closeTo(0.92, 0.001));
      expect(
        model.createdAt,
        equals(DateTime.parse('2026-05-07T10:00:00.000Z')),
      );
    });

    test('null olabilen alanlar eksikse null döner', () {
      final model = AnalysisApiModel.fromJson(minimalJson);

      expect(model.heatmapUrl, isNull);
      expect(model.doctorNote, isNull);
      expect(model.drGradeInt, isNull);
      expect(model.drFeedback, isNull);
      expect(model.isCorrect, isNull);
      expect(model.updatedAt, isNull);
    });

    test('drGradeInt ve heatmapUrl alanlarını parse eder', () {
      final json = {
        ...minimalJson,
        'drGradeInt': 2,
        'heatmapUrl': 'https://retina-ai.tech/heatmaps/abc.jpg',
        'drFeedback': 'Orta şiddetli retinopati',
      };
      final model = AnalysisApiModel.fromJson(json);

      expect(model.drGradeInt, equals(2));
      expect(
        model.heatmapUrl,
        equals('https://retina-ai.tech/heatmaps/abc.jpg'),
      );
      expect(model.drFeedback, equals('Orta şiddetli retinopati'));
    });

    test('confidence int olarak geldiğinde double\'a dönüştürür', () {
      final json = {...minimalJson, 'confidence': 1};
      final model = AnalysisApiModel.fromJson(json);

      expect(model.confidence, isA<double>());
      expect(model.confidence, closeTo(1.0, 0.001));
    });

    test('fromJson ile oluşturulan model isSynced=true döner', () {
      final model = AnalysisApiModel.fromJson(minimalJson);
      expect(model.isSynced, isTrue);
    });

    test('updatedAt varsa parse eder', () {
      final json = {...minimalJson, 'updatedAt': '2026-05-07T12:00:00.000Z'};
      final model = AnalysisApiModel.fromJson(json);

      expect(
        model.updatedAt,
        equals(DateTime.parse('2026-05-07T12:00:00.000Z')),
      );
    });

    test('report section alanlarını parse eder', () {
      final json = {
        ...minimalJson,
        'reportTitle': 'Retina AI Raporu',
        'sectionAnamnesis': 'Hasta 5 yıldır diyabetik.',
        'sectionTreatmentRecommendations': 'Lazer tedavisi önerilir.',
      };
      final model = AnalysisApiModel.fromJson(json);

      expect(model.reportTitle, equals('Retina AI Raporu'));
      expect(model.sectionAnamnesis, equals('Hasta 5 yıldır diyabetik.'));
      expect(
        model.sectionTreatmentRecommendations,
        equals('Lazer tedavisi önerilir.'),
      );
    });
  });

  group('AnalysisApiModel.toJson', () {
    test('null alanları JSON\'a dahil etmez', () {
      final model = AnalysisApiModel(
        id: 'x',
        patientId: 'p1',
        aiResult: 'no_dr',
        confidence: 0.85,
        createdAt: DateTime(2026, 5, 7),
      );

      final json = model.toJson();

      expect(json.containsKey('heatmapUrl'), isFalse);
      expect(json.containsKey('doctorNote'), isFalse);
      expect(json.containsKey('drGradeInt'), isFalse);
    });

    test('dolu alanları JSON\'a ekler', () {
      final model = AnalysisApiModel(
        id: 'x',
        patientId: 'p1',
        aiResult: 'moderate',
        confidence: 0.78,
        createdAt: DateTime(2026, 5, 7),
        drGradeInt: 2,
        doctorNote: 'Takip gerekli',
      );

      final json = model.toJson();

      expect(json['aiResult'], equals('moderate'));
      expect(json['confidence'], closeTo(0.78, 0.001));
      expect(json['drGradeInt'], equals(2));
      expect(json['doctorNote'], equals('Takip gerekli'));
    });
  });
}

import 'package:uuid/uuid.dart';

/// Lokal olarak kaydedilen klinik rapor modeli.
class ClinicalReportModel {
  final String id;
  final String patientId;
  final String title;
  final String doctorName;
  final String anamnesis;
  final String examFindings;
  final String labResults;
  final String diagnosis;
  final String treatment;
  final String doctorNotes;
  final String aiNotes;
  final String createdAt;

  const ClinicalReportModel({
    required this.id,
    required this.patientId,
    required this.title,
    required this.doctorName,
    required this.anamnesis,
    required this.examFindings,
    required this.labResults,
    required this.diagnosis,
    required this.treatment,
    required this.doctorNotes,
    required this.aiNotes,
    required this.createdAt,
  });

  factory ClinicalReportModel.create({
    required String patientId,
    required String title,
    required String doctorName,
    required String anamnesis,
    required String examFindings,
    required String labResults,
    required String diagnosis,
    required String treatment,
    required String doctorNotes,
    required String aiNotes,
  }) {
    return ClinicalReportModel(
      id: const Uuid().v4(),
      patientId: patientId,
      title: title.isEmpty ? 'Göz Muayene Raporu' : title,
      doctorName: doctorName,
      anamnesis: anamnesis,
      examFindings: examFindings,
      labResults: labResults,
      diagnosis: diagnosis,
      treatment: treatment,
      doctorNotes: doctorNotes,
      aiNotes: aiNotes,
      createdAt: DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'patient_id': patientId,
    'title': title,
    'doctor_name': doctorName,
    'anamnesis': anamnesis,
    'exam_findings': examFindings,
    'lab_results': labResults,
    'diagnosis': diagnosis,
    'treatment': treatment,
    'doctor_notes': doctorNotes,
    'ai_notes': aiNotes,
    'created_at': createdAt,
  };

  factory ClinicalReportModel.fromMap(Map<String, dynamic> map) {
    return ClinicalReportModel(
      id: map['id'] as String,
      patientId: map['patient_id'] as String,
      title: map['title'] as String? ?? '',
      doctorName: map['doctor_name'] as String? ?? '',
      anamnesis: map['anamnesis'] as String? ?? '',
      examFindings: map['exam_findings'] as String? ?? '',
      labResults: map['lab_results'] as String? ?? '',
      diagnosis: map['diagnosis'] as String? ?? '',
      treatment: map['treatment'] as String? ?? '',
      doctorNotes: map['doctor_notes'] as String? ?? '',
      aiNotes: map['ai_notes'] as String? ?? '',
      createdAt: map['created_at'] as String? ?? '',
    );
  }

  String get createdAtFormatted {
    final dt = DateTime.tryParse(createdAt)?.toLocal();
    if (dt == null) return createdAt;
    return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}';
  }
}

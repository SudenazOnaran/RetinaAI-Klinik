import 'dart:convert';

String? _jsonDynamicToNullableString(dynamic v) {
  if (v == null) return null;
  if (v is String) return v;
  try {
    return jsonEncode(v);
  } catch (_) {
    return v.toString();
  }
}

/// API ve yerel veritabanı için Analiz modeli.
class AnalysisApiModel {
  final String id;
  final String patientId;
  final String aiResult;
  final double confidence;
  final String? heatmapUrl;
  final String? originalImage;
  final String? doctorNote;
  final bool? isCorrect;
  final String? actualResult;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final bool isSynced;

  // Spec §6.4 — extended fields
  final int? drGradeInt;
  final String? drFeedback;
  final String? aiOdriLabels;
  final String? aiOdriConfidences;
  final String? ilaclar;
  final String? aiInferenceJson;
  final String? ffaImageUrl;
  final String? octImageUrl;
  final String? ffaDrFeedback;
  final String? octDrFeedback;
  /// Fundus NVD/NVE vb. yapısal düzeltme (JSON metni).
  final String? doctorStructuredReview;
  final String? reportKind;

  // Report sections (spec §6.7)
  final String? reportTitle;
  final String? reportDateKey;
  final String? reportDoctorDisplayName;
  final String? sectionAnamnesis;
  final String? sectionExamFindings;
  final String? sectionClinicalAssessment;
  final String? sectionLabResults;
  final String? sectionTreatmentRecommendations;
  final String? sectionDoctorNotes;

  const AnalysisApiModel({
    required this.id,
    required this.patientId,
    required this.aiResult,
    required this.confidence,
    this.heatmapUrl,
    this.originalImage,
    this.doctorNote,
    this.isCorrect,
    this.actualResult,
    required this.createdAt,
    this.updatedAt,
    this.isSynced = false,
    this.drGradeInt,
    this.drFeedback,
    this.aiOdriLabels,
    this.aiOdriConfidences,
    this.ilaclar,
    this.aiInferenceJson,
    this.ffaImageUrl,
    this.octImageUrl,
    this.ffaDrFeedback,
    this.octDrFeedback,
    this.doctorStructuredReview,
    this.reportKind,
    this.reportTitle,
    this.reportDateKey,
    this.reportDoctorDisplayName,
    this.sectionAnamnesis,
    this.sectionExamFindings,
    this.sectionClinicalAssessment,
    this.sectionLabResults,
    this.sectionTreatmentRecommendations,
    this.sectionDoctorNotes,
  });

  static bool _hasUrl(String? u) => u != null && u.trim().isNotEmpty;

  static Map<String, dynamic>? _parseInferenceRoot(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return decoded;
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {}
    return null;
  }

  /// Fundus / OCT / FFA — görüntü URL'leri ve AI snapshot'tan modalite.
  static String? resolveImagingModality(AnalysisApiModel a) {
    final rk = a.reportKind?.trim().toLowerCase();
    if (rk == 'oct' || rk == 'ffa' || rk == 'fundus') return rk;

    final fromUrls = inferImagingModalityFromUrls(a);
    if (fromUrls != null) return fromUrls;

    final root = _parseInferenceRoot(a.aiInferenceJson);
    if (root != null) {
      final modality = root['modality']?.toString().trim().toLowerCase();
      if (modality == 'oct' || modality == 'ffa' || modality == 'fundus') {
        return modality;
      }
      if (root['ffa'] is Map) return 'ffa';
      if (root['oct'] is Map) return 'oct';
      if (root.containsKey('pytorch') ||
          root.containsKey('drGrade') ||
          root.containsKey('dr_grade') ||
          root.containsKey('fundusFindings') ||
          root.containsKey('fundus_findings')) {
        return 'fundus';
      }
    }

    return null;
  }

  /// Radyolojik rapor PDF / önizleme için birincil görüntü yolu.
  static String? primaryImagePath(AnalysisApiModel a) {
    final k = resolveImagingModality(a);
    if (k == 'ffa') return a.ffaImageUrl ?? a.originalImage;
    if (k == 'oct') return a.octImageUrl ?? a.originalImage;
    return a.originalImage ?? a.ffaImageUrl ?? a.octImageUrl;
  }

  /// `ffaImageUrl` / `octImageUrl` öncelikli; heatmap tek başına fundus sayılmaz.
  static String? inferImagingModalityFromUrls(AnalysisApiModel a) {
    final hasFfa = _hasUrl(a.ffaImageUrl);
    final hasOct = _hasUrl(a.octImageUrl);
    final hasOrig = _hasUrl(a.originalImage);
    if (hasFfa && !hasOct) return 'ffa';
    if (hasOct && !hasFfa) return 'oct';
    if (hasOrig) return 'fundus';
    if (_hasUrl(a.heatmapUrl) && !hasFfa && !hasOct) return 'fundus';
    return null;
  }

  /// Sunucu `radiological_ai` + `originalImage` döndürse bile yerel OCT/FFA korunur.
  static AnalysisApiModel mergePreservingImagingModality(
    AnalysisApiModel server,
    AnalysisApiModel local,
  ) {
    String? pickKind(String? fromServer, String? fromLocal) {
      bool valid(String? k) =>
          k == 'oct' || k == 'ffa' || k == 'fundus';
      if (valid(fromServer)) return fromServer;
      if (valid(fromLocal)) return fromLocal;
      return null;
    }

    final inference =
        server.aiInferenceJson ?? local.aiInferenceJson;
    final resolvedKind = pickKind(server.reportKind, local.reportKind) ??
        resolveImagingModality(local.copyWith(aiInferenceJson: inference)) ??
        resolveImagingModality(server.copyWith(aiInferenceJson: inference));

    var ffaUrl = server.ffaImageUrl ?? local.ffaImageUrl;
    var octUrl = server.octImageUrl ?? local.octImageUrl;
    var origUrl = server.originalImage ?? local.originalImage;

    if (resolvedKind == 'ffa') {
      ffaUrl ??= origUrl;
      origUrl = null;
    } else if (resolvedKind == 'oct') {
      octUrl ??= origUrl;
      origUrl = null;
    }

    return server.copyWith(
      reportKind: resolvedKind ?? local.reportKind ?? server.reportKind,
      aiInferenceJson: inference,
      ffaImageUrl: ffaUrl,
      octImageUrl: octUrl,
      originalImage: origUrl,
      heatmapUrl: server.heatmapUrl ?? local.heatmapUrl,
      octDrFeedback: server.octDrFeedback ?? local.octDrFeedback,
      ffaDrFeedback: server.ffaDrFeedback ?? local.ffaDrFeedback,
      drFeedback: server.drFeedback ?? local.drFeedback,
      doctorStructuredReview:
          server.doctorStructuredReview ?? local.doctorStructuredReview,
    );
  }

  static String? _modalityFromJson(Map<String, dynamic> json) {
    final raw = json['reportKind'] ?? json['report_kind'];
    if (raw is! String) return null;
    final k = raw.trim().toLowerCase();
    if (k == 'oct' || k == 'ffa' || k == 'fundus') return k;
    return k.isEmpty ? null : k;
  }

  // API response -> Model
  factory AnalysisApiModel.fromJson(Map<String, dynamic> json) {
    return AnalysisApiModel(
      id: json['id'] as String,
      patientId: (json['patientId'] ?? json['patient_id']) as String,
      aiResult: json['aiResult'] as String,
      confidence: (json['confidence'] as num).toDouble(),
      heatmapUrl: json['heatmapUrl'] as String?,
      originalImage: json['originalImage'] as String?,
      doctorNote: json['doctorNote'] as String?,
      isCorrect: json['isCorrect'] as bool?,
      actualResult: json['actualResult'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
      isSynced: true,
      drGradeInt: json['drGradeInt'] as int?,
      drFeedback: json['drFeedback'] as String?,
      aiOdriLabels: json['aiOdriLabels'] as String?,
      aiOdriConfidences: json['aiOdriConfidences'] as String?,
      ilaclar: json['ilaclar'] as String?,
      aiInferenceJson: (json['aiInferenceJson'] ?? json['ai_inference_json'])
          ?.toString(),
      ffaImageUrl:
          (json['ffaImageUrl'] ?? json['ffa_image_url']) as String?,
      octImageUrl:
          (json['octImageUrl'] ?? json['oct_image_url']) as String?,
      ffaDrFeedback: json['ffaDrFeedback'] as String?,
      octDrFeedback: json['octDrFeedback'] as String?,
      doctorStructuredReview: _jsonDynamicToNullableString(
        json['doctorStructuredReview'],
      ),
      reportKind: _modalityFromJson(json),
      reportTitle: json['reportTitle'] as String?,
      reportDateKey: json['reportDateKey'] as String?,
      reportDoctorDisplayName: json['reportDoctorDisplayName'] as String?,
      sectionAnamnesis: json['sectionAnamnesis'] as String?,
      sectionExamFindings: json['sectionExamFindings'] as String?,
      sectionClinicalAssessment: json['sectionClinicalAssessment'] as String?,
      sectionLabResults: json['sectionLabResults'] as String?,
      sectionTreatmentRecommendations:
          json['sectionTreatmentRecommendations'] as String?,
      sectionDoctorNotes: json['sectionDoctorNotes'] as String?,
    );
  }

  // Model -> API request body
  Map<String, dynamic> toJson() {
    return {
      'patientId': patientId,
      'aiResult': aiResult,
      'confidence': confidence,
      if (heatmapUrl != null) 'heatmapUrl': heatmapUrl,
      if (originalImage != null) 'originalImage': originalImage,
      if (doctorNote != null) 'doctorNote': doctorNote,
      if (isCorrect != null) 'isCorrect': isCorrect,
      if (actualResult != null) 'actualResult': actualResult,
      if (drGradeInt != null) 'drGradeInt': drGradeInt,
      if (drFeedback != null) 'drFeedback': drFeedback,
      if (aiOdriLabels != null) 'aiOdriLabels': aiOdriLabels,
      if (aiOdriConfidences != null) 'aiOdriConfidences': aiOdriConfidences,
      if (ilaclar != null) 'ilaclar': ilaclar,
      if (ffaImageUrl != null) 'ffaImageUrl': ffaImageUrl,
      if (octImageUrl != null) 'octImageUrl': octImageUrl,
      if (ffaDrFeedback != null) 'ffaDrFeedback': ffaDrFeedback,
      if (octDrFeedback != null) 'octDrFeedback': octDrFeedback,
      if (doctorStructuredReview != null)
        'doctorStructuredReview': doctorStructuredReview,
      if (aiInferenceJson != null) 'aiInferenceJson': aiInferenceJson,
      if (reportKind != null) 'reportKind': reportKind,
      if (reportTitle != null) 'reportTitle': reportTitle,
      if (reportDateKey != null) 'reportDateKey': reportDateKey,
      if (reportDoctorDisplayName != null)
        'reportDoctorDisplayName': reportDoctorDisplayName,
      if (sectionAnamnesis != null) 'sectionAnamnesis': sectionAnamnesis,
      if (sectionExamFindings != null)
        'sectionExamFindings': sectionExamFindings,
      if (sectionClinicalAssessment != null)
        'sectionClinicalAssessment': sectionClinicalAssessment,
      if (sectionLabResults != null) 'sectionLabResults': sectionLabResults,
      if (sectionTreatmentRecommendations != null)
        'sectionTreatmentRecommendations': sectionTreatmentRecommendations,
      if (sectionDoctorNotes != null) 'sectionDoctorNotes': sectionDoctorNotes,
    };
  }

  // SQLite -> Model (only core fields stored locally)
  factory AnalysisApiModel.fromMap(Map<String, dynamic> map) {
    return AnalysisApiModel(
      id: map['id'] as String,
      patientId: map['patient_id'] as String,
      aiResult: map['ai_result'] as String,
      confidence: (map['confidence'] as num).toDouble(),
      heatmapUrl: map['heatmap_url'] as String?,
      originalImage: map['original_image'] as String?,
      doctorNote: map['doctor_note'] as String?,
      isCorrect: map['is_correct'] != null
          ? (map['is_correct'] as int) == 1
          : null,
      actualResult: map['actual_result'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: map['updated_at'] != null
          ? DateTime.parse(map['updated_at'] as String)
          : null,
      isSynced: (map['is_synced'] as int) == 1,
      drGradeInt: map['dr_grade_int'] as int?,
      drFeedback: map['dr_feedback'] as String?,
      ilaclar: map['ilaclar'] as String?,
      aiInferenceJson: map['ai_inference_json'] as String?,
      ffaImageUrl: map['ffa_image_url'] as String?,
      octImageUrl: map['oct_image_url'] as String?,
      octDrFeedback: map['oct_dr_feedback'] as String?,
      ffaDrFeedback: map['ffa_dr_feedback'] as String?,
      doctorStructuredReview: map['doctor_structured_review'] as String?,
      reportKind: map['report_kind'] as String?,
    );
  }

  // Model -> SQLite
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'patient_id': patientId,
      'ai_result': aiResult,
      'confidence': confidence,
      'heatmap_url': heatmapUrl,
      'original_image': originalImage,
      'doctor_note': doctorNote,
      'is_correct': isCorrect != null ? (isCorrect! ? 1 : 0) : null,
      'actual_result': actualResult,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'is_synced': isSynced ? 1 : 0,
      'dr_grade_int': drGradeInt,
      'dr_feedback': drFeedback,
      'ilaclar': ilaclar,
      'report_kind': reportKind,
      'ai_inference_json': aiInferenceJson,
      'oct_image_url': octImageUrl,
      'ffa_image_url': ffaImageUrl,
      'oct_dr_feedback': octDrFeedback,
      'ffa_dr_feedback': ffaDrFeedback,
      'doctor_structured_review': doctorStructuredReview,
    };
  }

  /// PATCH gövdesi: null atamak için `containsKey` kullanılır (copyWith ile mümkün değil).
  AnalysisApiModel applyFeedbackPatch(Map<String, dynamic> fields) {
    return AnalysisApiModel(
      id: id,
      patientId: patientId,
      aiResult: aiResult,
      confidence: confidence,
      heatmapUrl: heatmapUrl,
      originalImage: originalImage,
      doctorNote: fields.containsKey('doctorNote')
          ? fields['doctorNote'] as String?
          : doctorNote,
      isCorrect: fields.containsKey('isCorrect')
          ? fields['isCorrect'] as bool?
          : isCorrect,
      actualResult: fields.containsKey('actualResult')
          ? fields['actualResult'] as String?
          : actualResult,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
      isSynced: false,
      drGradeInt: drGradeInt,
      drFeedback: fields.containsKey('drFeedback')
          ? fields['drFeedback'] as String?
          : drFeedback,
      aiOdriLabels: aiOdriLabels,
      aiOdriConfidences: aiOdriConfidences,
      ilaclar: ilaclar,
      aiInferenceJson: aiInferenceJson,
      ffaImageUrl: ffaImageUrl,
      octImageUrl: octImageUrl,
      ffaDrFeedback: fields.containsKey('ffaDrFeedback')
          ? fields['ffaDrFeedback'] as String?
          : ffaDrFeedback,
      octDrFeedback: fields.containsKey('octDrFeedback')
          ? fields['octDrFeedback'] as String?
          : octDrFeedback,
      doctorStructuredReview: fields.containsKey('doctorStructuredReview')
          ? fields['doctorStructuredReview'] as String?
          : doctorStructuredReview,
      reportKind: reportKind,
      reportTitle: reportTitle,
      reportDateKey: reportDateKey,
      reportDoctorDisplayName: reportDoctorDisplayName,
      sectionAnamnesis: sectionAnamnesis,
      sectionExamFindings: sectionExamFindings,
      sectionClinicalAssessment: sectionClinicalAssessment,
      sectionLabResults: sectionLabResults,
      sectionTreatmentRecommendations: sectionTreatmentRecommendations,
      sectionDoctorNotes: sectionDoctorNotes,
    );
  }

  AnalysisApiModel copyWith({
    String? id,
    String? patientId,
    String? aiResult,
    double? confidence,
    String? heatmapUrl,
    String? originalImage,
    String? doctorNote,
    bool? isCorrect,
    String? actualResult,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isSynced,
    int? drGradeInt,
    String? drFeedback,
    String? aiOdriLabels,
    String? aiOdriConfidences,
    String? ilaclar,
    String? aiInferenceJson,
    String? ffaImageUrl,
    String? octImageUrl,
    String? ffaDrFeedback,
    String? octDrFeedback,
    String? doctorStructuredReview,
    String? reportKind,
    String? reportTitle,
    String? reportDateKey,
    String? reportDoctorDisplayName,
    String? sectionAnamnesis,
    String? sectionExamFindings,
    String? sectionClinicalAssessment,
    String? sectionLabResults,
    String? sectionTreatmentRecommendations,
    String? sectionDoctorNotes,
  }) {
    return AnalysisApiModel(
      id: id ?? this.id,
      patientId: patientId ?? this.patientId,
      aiResult: aiResult ?? this.aiResult,
      confidence: confidence ?? this.confidence,
      heatmapUrl: heatmapUrl ?? this.heatmapUrl,
      originalImage: originalImage ?? this.originalImage,
      doctorNote: doctorNote ?? this.doctorNote,
      isCorrect: isCorrect ?? this.isCorrect,
      actualResult: actualResult ?? this.actualResult,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isSynced: isSynced ?? this.isSynced,
      drGradeInt: drGradeInt ?? this.drGradeInt,
      drFeedback: drFeedback ?? this.drFeedback,
      aiOdriLabels: aiOdriLabels ?? this.aiOdriLabels,
      aiOdriConfidences: aiOdriConfidences ?? this.aiOdriConfidences,
      ilaclar: ilaclar ?? this.ilaclar,
      aiInferenceJson: aiInferenceJson ?? this.aiInferenceJson,
      ffaImageUrl: ffaImageUrl ?? this.ffaImageUrl,
      octImageUrl: octImageUrl ?? this.octImageUrl,
      ffaDrFeedback: ffaDrFeedback ?? this.ffaDrFeedback,
      octDrFeedback: octDrFeedback ?? this.octDrFeedback,
      doctorStructuredReview:
          doctorStructuredReview ?? this.doctorStructuredReview,
      reportKind: reportKind ?? this.reportKind,
      reportTitle: reportTitle ?? this.reportTitle,
      reportDateKey: reportDateKey ?? this.reportDateKey,
      reportDoctorDisplayName:
          reportDoctorDisplayName ?? this.reportDoctorDisplayName,
      sectionAnamnesis: sectionAnamnesis ?? this.sectionAnamnesis,
      sectionExamFindings: sectionExamFindings ?? this.sectionExamFindings,
      sectionClinicalAssessment:
          sectionClinicalAssessment ?? this.sectionClinicalAssessment,
      sectionLabResults: sectionLabResults ?? this.sectionLabResults,
      sectionTreatmentRecommendations:
          sectionTreatmentRecommendations ??
          this.sectionTreatmentRecommendations,
      sectionDoctorNotes: sectionDoctorNotes ?? this.sectionDoctorNotes,
    );
  }
}

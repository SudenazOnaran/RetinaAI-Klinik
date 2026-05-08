/// Condensed last-analysis summary returned by GET /patients list.
class LastAnalysisSummary {
  final String id;
  final String aiResult;
  final double confidence;
  final DateTime createdAt;

  const LastAnalysisSummary({
    required this.id,
    required this.aiResult,
    required this.confidence,
    required this.createdAt,
  });

  factory LastAnalysisSummary.fromJson(Map<String, dynamic> json) {
    return LastAnalysisSummary(
      id: json['id'] as String,
      aiResult: json['aiResult'] as String,
      confidence: (json['confidence'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

/// API ve yerel veritabanı için Hasta modeli.
class PatientApiModel {
  final String id;
  final String fullName;
  final String tcNo;
  final int age;
  final String? gender;
  final String risk;
  final int? diabetesYears;
  final double? hba1c;
  final DateTime createdAt;
  final DateTime? updatedAt;
  final bool isSynced;

  // Spec §4.3 — list response extras (not persisted locally)
  final int? analysisCount;
  final LastAnalysisSummary? lastAnalysis;

  const PatientApiModel({
    required this.id,
    required this.fullName,
    required this.tcNo,
    required this.age,
    this.gender,
    required this.risk,
    this.diabetesYears,
    this.hba1c,
    required this.createdAt,
    this.updatedAt,
    this.isSynced = false,
    this.analysisCount,
    this.lastAnalysis,
  });

  // API response -> Model
  factory PatientApiModel.fromJson(Map<String, dynamic> json) {
    return PatientApiModel(
      id: json['id'] as String,
      fullName: json['fullName'] as String,
      tcNo: json['tcNo'] as String,
      age: json['age'] as int,
      gender: json['gender'] as String?,
      risk: json['risk'] as String,
      diabetesYears: json['diabetesYears'] as int?,
      hba1c: (json['hba1c'] as num?)?.toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : null,
      isSynced: true,
      analysisCount: json['analysisCount'] as int?,
      lastAnalysis: json['lastAnalysis'] != null
          ? LastAnalysisSummary.fromJson(
              json['lastAnalysis'] as Map<String, dynamic>,
            )
          : null,
    );
  }

  // Model -> API request body
  Map<String, dynamic> toJson() {
    return {
      'fullName': fullName,
      'tcNo': tcNo,
      'age': age,
      if (gender != null) 'gender': gender,
      'risk': risk,
      if (diabetesYears != null) 'diabetesYears': diabetesYears,
      if (hba1c != null) 'hba1c': hba1c,
    };
  }

  // SQLite -> Model
  factory PatientApiModel.fromMap(Map<String, dynamic> map) {
    return PatientApiModel(
      id: map['id'] as String,
      fullName: map['full_name'] as String,
      tcNo: map['tc_no'] as String,
      age: map['age'] as int,
      gender: map['gender'] as String?,
      risk: map['risk'] as String,
      diabetesYears: map['diabetes_years'] as int?,
      hba1c: map['hba1c'] as double?,
      createdAt: DateTime.parse(map['created_at'] as String),
      updatedAt: map['updated_at'] != null
          ? DateTime.parse(map['updated_at'] as String)
          : null,
      isSynced: (map['is_synced'] as int) == 1,
    );
  }

  // Model -> SQLite
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'full_name': fullName,
      'tc_no': tcNo,
      'age': age,
      'gender': gender,
      'risk': risk,
      'diabetes_years': diabetesYears,
      'hba1c': hba1c,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'is_synced': isSynced ? 1 : 0,
    };
  }

  PatientApiModel copyWith({
    String? id,
    String? fullName,
    String? tcNo,
    int? age,
    String? gender,
    String? risk,
    int? diabetesYears,
    double? hba1c,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isSynced,
    int? analysisCount,
    LastAnalysisSummary? lastAnalysis,
  }) {
    return PatientApiModel(
      id: id ?? this.id,
      fullName: fullName ?? this.fullName,
      tcNo: tcNo ?? this.tcNo,
      age: age ?? this.age,
      gender: gender ?? this.gender,
      risk: risk ?? this.risk,
      diabetesYears: diabetesYears ?? this.diabetesYears,
      hba1c: hba1c ?? this.hba1c,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isSynced: isSynced ?? this.isSynced,
      analysisCount: analysisCount ?? this.analysisCount,
      lastAnalysis: lastAnalysis ?? this.lastAnalysis,
    );
  }
}

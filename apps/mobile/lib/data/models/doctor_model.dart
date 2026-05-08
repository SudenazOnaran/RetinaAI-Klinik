import 'dart:convert';

/// Giriş yapmış doktor bilgilerini tutar.
class DoctorModel {
  final String id;
  final String name;
  final String surname;
  final String email;
  final String role;
  final String? specialty;
  final String? hospital;

  const DoctorModel({
    required this.id,
    required this.name,
    required this.surname,
    required this.email,
    required this.role,
    this.specialty,
    this.hospital,
  });

  String get fullName => '$name $surname';

  factory DoctorModel.fromJson(Map<String, dynamic> json) {
    return DoctorModel(
      id: json['id'] as String,
      name: json['name'] as String,
      surname: json['surname'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      specialty: json['specialty'] as String?,
      hospital: json['hospital'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'surname': surname,
      'email': email,
      'role': role,
      if (specialty != null) 'specialty': specialty,
      if (hospital != null) 'hospital': hospital,
    };
  }

  /// Secure Storage'a kaydetmek için JSON string.
  String toJsonString() => jsonEncode(toJson());

  factory DoctorModel.fromJsonString(String jsonString) {
    return DoctorModel.fromJson(jsonDecode(jsonString) as Map<String, dynamic>);
  }
}

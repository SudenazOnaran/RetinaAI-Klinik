import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../local/secure_storage.dart';
import '../models/doctor_model.dart';

/// Authentication repository: login, verify, logout.
class AuthRepository {
  AuthRepository._();
  static final AuthRepository instance = AuthRepository._();

  final _api = ApiClient.instance;
  final _storage = SecureStorageService.instance;

  /// Giriş yap ve token ile doktor bilgisini sakla.
  Future<DoctorModel> login(String email, String password) async {
    final response = await _api.post(
      ApiConstants.login,
      data: {'email': email, 'password': password},
    );

    final data = response.data as Map<String, dynamic>;
    if (data['success'] != true) {
      throw Exception(data['error'] ?? 'Giriş başarısız');
    }

    final token = data['token'] as String;
    final doctor = DoctorModel.fromJson(data['doctor'] as Map<String, dynamic>);

    await _storage.saveToken(token);
    await _storage.saveDoctorId(doctor.id);
    await _storage.saveDoctorData(doctor.toJsonString());

    return doctor;
  }

  /// Mevcut token'ın geçerliliğini doğrula.
  Future<DoctorModel?> verifyToken() async {
    try {
      final response = await _api.post(ApiConstants.verify);
      final data = response.data as Map<String, dynamic>;
      if (data['success'] == true && data['valid'] == true) {
        return DoctorModel.fromJson(data['doctor'] as Map<String, dynamic>);
      }
      return null;
    } on DioException {
      return null;
    }
  }

  /// Oturumu kapat: token ve yerel veriler temizlenir.
  Future<void> logout() async {
    await _storage.clearAll();
  }

  /// Kayıtlı doktor bilgisini döner (önbellekten).
  Future<DoctorModel?> getCachedDoctor() async {
    final jsonStr = await _storage.getDoctorData();
    if (jsonStr == null) return null;
    return DoctorModel.fromJsonString(jsonStr);
  }

  Future<bool> isLoggedIn() => _storage.isLoggedIn();
}

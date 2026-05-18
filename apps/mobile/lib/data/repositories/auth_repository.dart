import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../local/secure_storage.dart';
import '../local/database/app_database.dart';
import '../models/doctor_model.dart';

/// Authentication repository: login, verify, logout.
class AuthRepository {
  AuthRepository._();
  static final AuthRepository instance = AuthRepository._();

  static const String _userNotRegistered =
      'Bu e-posta adresi ile kayıtlı bir kullanıcı bulunmuyor.';
  static const String _wrongPassword = 'Şifre yanlış.';

  final _api = ApiClient.instance;
  final _storage = SecureStorageService.instance;

  /// Giriş yap ve token ile doktor bilgisini sakla.
  Future<DoctorModel> login(String email, String password) async {
    try {
      final response = await _api.post(
        ApiConstants.login,
        data: {'email': email, 'password': password},
      );

      final data = response.data as Map<String, dynamic>;
      if (data['success'] != true) {
        final raw = data['error']?.toString() ?? data['message']?.toString();
        throw Exception(_friendlyLoginMessage(raw: raw, statusCode: null));
      }

      final token = data['token'] as String;
      final doctor =
          DoctorModel.fromJson(data['doctor'] as Map<String, dynamic>);

      await _storage.saveToken(token);
      await _storage.saveDoctorId(doctor.id);
      await _storage.saveDoctorData(doctor.toJsonString());

      return doctor;
    } on DioException catch (e) {
      throw Exception(_friendlyLoginMessageFromDio(e));
    }
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

  /// Sunucuda hesabı kalıcı olarak siler; yerel güvenli depolama ve SQLite temizlenir.
  Future<void> deleteAccount() async {
    try {
      final response = await _api.delete(ApiConstants.accountDelete);
      final data = response.data;
      if (data is Map<String, dynamic> && data['success'] == true) {
        await _storage.clearAll();
        await AppDatabase.instance.clearAll();
        return;
      }
      final err =
          data is Map<String, dynamic> ? data['error']?.toString() : null;
      throw Exception(
        (err != null && err.isNotEmpty) ? err : 'Hesap silinemedi',
      );
    } on DioException catch (e) {
      throw Exception(_friendlyDeleteMessageFromDio(e));
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

  static String _friendlyLoginMessageFromDio(DioException e) {
    final code = e.response?.statusCode;
    String? raw;
    final d = e.response?.data;
    if (d is Map<String, dynamic>) {
      raw = d['error']?.toString() ??
          d['message']?.toString() ??
          d['detail']?.toString();
    } else if (d is String) {
      raw = d;
    }

    if (raw == null || raw.isEmpty) {
      final t = e.type;
      if (t == DioExceptionType.connectionTimeout ||
          t == DioExceptionType.receiveTimeout ||
          t == DioExceptionType.sendTimeout) {
        return 'Bağlantı zaman aşımına uğradı. İnternetinizi kontrol edin.';
      }
      if (t == DioExceptionType.connectionError) {
        return 'Sunucuya bağlanılamadı. Ağınızı kontrol edin.';
      }
    }

    return _friendlyLoginMessage(raw: raw, statusCode: code);
  }

  static String _friendlyDeleteMessageFromDio(DioException e) {
    final code = e.response?.statusCode;
    String? raw;
    final d = e.response?.data;
    if (d is Map<String, dynamic>) {
      raw = d['error']?.toString() ??
          d['message']?.toString() ??
          d['detail']?.toString();
    } else if (d is String) {
      raw = d;
    }
    if (raw != null && raw.isNotEmpty && raw.length <= 160) return raw;
    if (code == 401) return 'Oturumunuz geçersiz. Lütfen tekrar giriş yapın.';
    final t = e.type;
    if (t == DioExceptionType.connectionTimeout ||
        t == DioExceptionType.receiveTimeout ||
        t == DioExceptionType.sendTimeout) {
      return 'Bağlantı zaman aşımına uğradı. İnternetinizi kontrol edin.';
    }
    if (t == DioExceptionType.connectionError) {
      return 'Sunucuya bağlanılamadı. Ağınızı kontrol edin.';
    }
    return 'Hesap şu anda silinemedi. Lütfen daha sonra tekrar deneyin.';
  }

  /// Sunucu gövdesi ve/veya HTTP koduna göre kısa, anlaşılır Türkçe metin.
  static String _friendlyLoginMessage({String? raw, int? statusCode}) {
    if (statusCode == 404) return _userNotRegistered;
    if (statusCode == 401) return _wrongPassword;

    final blob = '${raw ?? ''} $statusCode'.toLowerCase();

    if (_looksLikeUnknownEmail(blob)) return _userNotRegistered;
    if (_looksLikeWrongPassword(blob)) return _wrongPassword;

    if (raw != null && raw.isNotEmpty && !_isNoisyTechnicalMessage(raw)) {
      if (raw.length <= 120) return raw;
    }

    return 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.';
  }

  static bool _looksLikeUnknownEmail(String blob) {
    const keys = [
      'kayıtlı değil',
      'kayitli degil',
      'kullanıcı bulunamadı',
      'kullanici bulunamadi',
      'bulunamadı',
      'bulunamadi',
      'not found',
      'user not found',
      'email not found',
      'no user',
      'unknown user',
      'no account',
      'not registered',
      'does not exist',
      'unknown email',
    ];
    return keys.any(blob.contains);
  }

  static bool _looksLikeWrongPassword(String blob) {
    const keys = [
      'şifre hatalı',
      'sifre hatali',
      'şifre yanlış',
      'sifre yanlis',
      'wrong password',
      'invalid password',
      'incorrect password',
      'bad credentials',
      'unauthorized',
    ];
    if (keys.any(blob.contains)) return true;
    // "şifre" kelimesi tek başına (ör. "Geçersiz şifre")
    if (blob.contains('şifre') || blob.contains('sifre')) return true;
    if (blob.contains('password')) return true;
    return false;
  }

  static bool _isNoisyTechnicalMessage(String s) {
    final l = s.toLowerCase();
    return l.contains('dioexception') ||
        l.contains('statuscode') ||
        l.contains('connection error') ||
        l.contains('socketexception');
  }
}

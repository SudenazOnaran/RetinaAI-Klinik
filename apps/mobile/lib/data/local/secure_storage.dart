import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../core/constants/api_constants.dart';

/// Flutter Secure Storage üzerinden token ve kullanıcı bilgilerini yönetir.
class SecureStorageService {
  SecureStorageService._();
  static final SecureStorageService instance = SecureStorageService._();

  static const FlutterSecureStorage _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  // --- Token ---

  Future<void> saveToken(String token) async {
    await _storage.write(key: ApiConstants.tokenKey, value: token);
  }

  Future<String?> getToken() async {
    return _storage.read(key: ApiConstants.tokenKey);
  }

  Future<void> deleteToken() async {
    await _storage.delete(key: ApiConstants.tokenKey);
  }

  // --- Doctor ---

  Future<void> saveDoctorId(String id) async {
    await _storage.write(key: ApiConstants.doctorIdKey, value: id);
  }

  Future<String?> getDoctorId() async {
    return _storage.read(key: ApiConstants.doctorIdKey);
  }

  Future<void> saveDoctorData(String jsonString) async {
    await _storage.write(key: ApiConstants.doctorDataKey, value: jsonString);
  }

  Future<String?> getDoctorData() async {
    return _storage.read(key: ApiConstants.doctorDataKey);
  }

  // --- Last Sync ---

  Future<void> saveLastSyncDate(DateTime date) async {
    await _storage.write(
      key: ApiConstants.lastSyncKey,
      value: date.toIso8601String(),
    );
  }

  Future<DateTime?> getLastSyncDate() async {
    final value = await _storage.read(key: ApiConstants.lastSyncKey);
    if (value == null) return null;
    return DateTime.tryParse(value);
  }

  // --- Logout - tüm verileri temizle ---

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  /// Oturum açık mı?
  Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}

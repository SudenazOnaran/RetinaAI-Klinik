import 'package:uuid/uuid.dart';

/// Offline kayıtlar için UUID tabanlı ID üretici.
class UuidGenerator {
  UuidGenerator._();

  static const Uuid _uuid = Uuid();

  /// Offline kayıt ID'si üretir. Format: offline_<uuid>
  static String generateOfflineId() {
    return 'offline_${_uuid.v4()}';
  }

  /// ID'nin offline (senkronize edilmemiş) olup olmadığını kontrol eder.
  static bool isOfflineId(String id) {
    return id.startsWith('offline_');
  }

  /// Saf UUID üretir (batch işlemleri vb. için).
  static String generate() {
    return _uuid.v4();
  }
}

import 'package:connectivity_plus/connectivity_plus.dart';

/// İnternet bağlantısı kontrolü için yardımcı sınıf.
class ConnectivityUtils {
  ConnectivityUtils._();

  static final Connectivity _connectivity = Connectivity();

  /// Şu anda internet bağlantısı var mı kontrol eder.
  static Future<bool> isConnected() async {
    final result = await _connectivity.checkConnectivity();
    // connectivity_plus 5.x returns a single ConnectivityResult
    return result == ConnectivityResult.mobile ||
        result == ConnectivityResult.wifi ||
        result == ConnectivityResult.ethernet;
  }
}

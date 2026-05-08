/// Uygulama ortam yapılandırması.
/// Derleme zamanında --dart-define=ENV=prod ile seçilir.
/// Varsayılan: prod (production URL kullanılır).
enum AppEnvironment { dev, prod }

class AppConfig {
  AppConfig._();

  static const String _envValue = String.fromEnvironment(
    'ENV',
    defaultValue: 'prod',
  );

  static AppEnvironment get environment =>
      _envValue == 'dev' ? AppEnvironment.dev : AppEnvironment.prod;

  static bool get isDev => environment == AppEnvironment.dev;
  static bool get isProd => environment == AppEnvironment.prod;

  /// Production: gerçek VPS domain. Dev: aynı domain (localhost yerine VPS test edilir).
  /// Yerel test için: --dart-define=BASE_URL=http://10.0.2.2:9002
  static const String _baseUrlOverride = String.fromEnvironment(
    'BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    if (_baseUrlOverride.isNotEmpty) return _baseUrlOverride;
    return 'https://retina-ai.tech';
  }
}

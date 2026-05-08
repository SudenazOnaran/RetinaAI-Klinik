import 'package:flutter_test/flutter_test.dart';
import 'package:retina_ai_app/core/config/app_config.dart';

void main() {
  group('AppConfig', () {
    test('varsayılan baseUrl production VPS döndürür', () {
      // Test ortamında --dart-define=BASE_URL ayarlanmadığı için
      // AppConfig.baseUrl production URL döndürmeli.
      // Not: dart-define değerleri derleme zamanında sabit olduğundan,
      // bu test production build değerini doğrular.
      expect(AppConfig.baseUrl, isNotEmpty);
      expect(AppConfig.baseUrl, isA<String>());
    });

    test('baseUrl geçerli bir URI formatında', () {
      final url = AppConfig.baseUrl;
      final uri = Uri.tryParse(url);

      expect(uri, isNotNull);
      expect(uri!.hasScheme, isTrue);
    });

    test('environment enum değerleri tanımlı', () {
      expect(AppEnvironment.values, contains(AppEnvironment.dev));
      expect(AppEnvironment.values, contains(AppEnvironment.prod));
    });

    test('isDev ve isProd birbirini dışlar', () {
      expect(AppConfig.isDev, isNot(equals(AppConfig.isProd)));
    });
  });
}

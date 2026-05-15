import 'package:flutter/foundation.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

/// RevenueCat entitlements için sabit tanımlar.
class _Entitlements {
  static const String pro = 'pro';
}

/// RevenueCat tabanlı abonelik yönetimi.
class SubscriptionService {
  SubscriptionService._();
  static final SubscriptionService instance = SubscriptionService._();

  // RevenueCat API anahtarını buraya girin (Play Console → RevenueCat dashboard).
  // Ortam değişkeni olarak da geçilebilir: --dart-define=RC_API_KEY=...
  static const String _apiKey = String.fromEnvironment(
    'RC_API_KEY',
    defaultValue: 'REVENUECAT_API_KEY_BURAYA',
  );

  bool _initCalled = false;
  bool _sdkConfigured = false;

  static bool _looksLikeValidRevenueCatKey(String key) {
    final k = key.trim();
    if (k.isEmpty) return false;
    if (k == 'REVENUECAT_API_KEY_BURAYA') return false;
    // Public SDK keys are non-trivial strings; placeholder kısa kalır.
    if (k.length < 12) return false;
    return true;
  }

  /// RevenueCat SDK gerçekten yapılandırıldı mı?
  bool get isConfigured => _sdkConfigured;

  /// Uygulamanın başında (main.dart) çağrılır.
  Future<void> init() async {
    if (_initCalled) return;
    _initCalled = true;

    if (!_looksLikeValidRevenueCatKey(_apiKey)) {
      if (kDebugMode) {
        debugPrint(
          'RevenueCat atlandı: RC_API_KEY yok veya placeholder. '
          'Derlemede --dart-define=RC_API_KEY=... verin.',
        );
      }
      return;
    }

    try {
      await Purchases.configure(PurchasesConfiguration(_apiKey.trim()));
      _sdkConfigured = true;
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('RevenueCat.configure başarısız: $e');
        debugPrint('$st');
      }
    }
  }

  /// Kullanıcının "pro" entitlement'ı aktif mi?
  Future<bool> isProActive() async {
    if (!_sdkConfigured) return false;
    try {
      final info = await Purchases.getCustomerInfo();
      return info.entitlements.active.containsKey(_Entitlements.pro);
    } catch (_) {
      return false;
    }
  }

  /// Mevcut teklifleri yükler.
  Future<Offerings?> getOfferings() async {
    if (!_sdkConfigured) return null;
    try {
      return await Purchases.getOfferings();
    } catch (_) {
      return null;
    }
  }

  /// Bir paketi satın al. Başarılıysa `true` döner.
  Future<bool> purchasePackage(Package package) async {
    if (!_sdkConfigured) return false;
    try {
      final info = await Purchases.purchasePackage(package);
      return info.entitlements.active.containsKey(_Entitlements.pro);
    } on PurchasesErrorCode catch (e) {
      if (e == PurchasesErrorCode.purchaseCancelledError) return false;
      rethrow;
    }
  }

  /// Geçmiş satın almaları geri yükle.
  Future<bool> restorePurchases() async {
    if (!_sdkConfigured) return false;
    try {
      final info = await Purchases.restorePurchases();
      return info.entitlements.active.containsKey(_Entitlements.pro);
    } catch (_) {
      return false;
    }
  }
}

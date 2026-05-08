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

  bool _initialized = false;

  /// Uygulamanın başında (main.dart) çağrılır.
  Future<void> init() async {
    if (_initialized) return;
    await Purchases.configure(PurchasesConfiguration(_apiKey));
    _initialized = true;
  }

  /// Kullanıcının "pro" entitlement'ı aktif mi?
  Future<bool> isProActive() async {
    try {
      final info = await Purchases.getCustomerInfo();
      return info.entitlements.active.containsKey(_Entitlements.pro);
    } catch (_) {
      return false;
    }
  }

  /// Mevcut teklifleri yükler.
  Future<Offerings?> getOfferings() async {
    try {
      return await Purchases.getOfferings();
    } catch (_) {
      return null;
    }
  }

  /// Bir paketi satın al. Başarılıysa `true` döner.
  Future<bool> purchasePackage(Package package) async {
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
    try {
      final info = await Purchases.restorePurchases();
      return info.entitlements.active.containsKey(_Entitlements.pro);
    } catch (_) {
      return false;
    }
  }
}

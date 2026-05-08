import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../theme/app_theme.dart';
import '../core/services/subscription_service.dart';

class PricingScreen extends ConsumerStatefulWidget {
  const PricingScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<PricingScreen> createState() => _PricingScreenState();
}

class _PricingScreenState extends ConsumerState<PricingScreen> {
  Offerings? _offerings;
  bool _loading = true;
  bool _purchasing = false;

  @override
  void initState() {
    super.initState();
    _loadOfferings();
  }

  Future<void> _loadOfferings() async {
    final offerings = await SubscriptionService.instance.getOfferings();
    if (mounted) {
      setState(() {
        _offerings = offerings;
        _loading = false;
      });
    }
  }

  Future<void> _purchase(Package package) async {
    setState(() => _purchasing = true);
    try {
      final success = await SubscriptionService.instance.purchasePackage(package);
      if (!mounted) return;
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Abonelik başarıyla aktifleştirildi!'),
            backgroundColor: Color(0xFF2E7D32),
          ),
        );
        context.go('/home');
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Satın alma hatası: $e'),
            backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _purchasing = false);
    }
  }

  Future<void> _restore() async {
    setState(() => _purchasing = true);
    try {
      final restored = await SubscriptionService.instance.restorePurchases();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(restored
              ? 'Satın almalar geri yüklendi!'
              : 'Geri yüklenecek aktif abonelik bulunamadı.'),
        ),
      );
      if (restored) context.go('/home');
    } finally {
      if (mounted) setState(() => _purchasing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = _offerings?.current;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Planlarımız',
          style: GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.w600),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Planınızı Seçin',
              style: GoogleFonts.manrope(
                  fontSize: 28, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              'Klinik başarınızı AI gücüyle artırın.',
              style: GoogleFonts.inter(
                  fontSize: 14, color: Colors.grey[600]),
            ),
            const SizedBox(height: 24),

            // 7 gün deneme banner
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF06B6D4).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: const Color(0xFF06B6D4).withOpacity(0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome, color: Color(0xFF06B6D4)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('7 Günlük Ücretsiz Deneme',
                            style: GoogleFonts.manrope(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFF06B6D4))),
                        Text('Özel Tanıtım Teklifi',
                            style: GoogleFonts.inter(
                                fontSize: 11, color: Colors.grey[600])),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (current != null) ...[
              // RevenueCat paketleri
              ...current.availablePackages.map((pkg) {
                final isPro = pkg.packageType == PackageType.monthly ||
                    pkg.packageType == PackageType.annual;
                final priceStr =
                    pkg.storeProduct.priceString;
                final title = pkg.packageType == PackageType.annual
                    ? 'Yıllık Pro'
                    : pkg.packageType == PackageType.monthly
                        ? 'Aylık Pro'
                        : pkg.storeProduct.title;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: _buildPlanCard(
                    title: title,
                    price: priceStr,
                    subtitle: isPro ? 'EN POPÜLER' : null,
                    features: _featuresForPackage(pkg),
                    isPrimary: isPro,
                    isLoading: _purchasing,
                    onTap: () => _purchase(pkg),
                  ),
                );
              }),
            ] else ...[
              // RevenueCat bağlı değilse statik gösterim
              _buildPlanCard(
                title: 'Pro',
                price: '₺49/ay',
                subtitle: 'EN POPÜLER',
                features: [
                  'Sınırsız tarama',
                  'Gelişmiş Tanı Haritalama',
                  'AI Risk Uyarıları',
                ],
                isPrimary: true,
                isLoading: false,
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                          'Ödeme sistemi yapılandırılıyor. Lütfen daha sonra tekrar deneyin.'),
                    ),
                  );
                },
              ),
            ],

            const SizedBox(height: 8),
            Center(
              child: TextButton(
                onPressed: _purchasing ? null : _restore,
                child: Text(
                  'Satın Almaları Geri Yükle',
                  style: GoogleFonts.inter(
                      fontSize: 13, color: AppColors.secondary),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<String> _featuresForPackage(Package pkg) {
    if (pkg.packageType == PackageType.annual) {
      return [
        'Sınırsız tarama',
        'Gelişmiş Tanı Haritalama',
        'AI Risk Uyarıları',
        'Yıllık fatura — %20 tasarruf',
      ];
    }
    return [
      'Sınırsız tarama',
      'Gelişmiş Tanı Haritalama',
      'AI Risk Uyarıları',
    ];
  }

  Widget _buildPlanCard({
    required String title,
    required String price,
    String? subtitle,
    required List<String> features,
    required bool isPrimary,
    required bool isLoading,
    VoidCallback? onTap,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        border: isPrimary
            ? Border.all(color: const Color(0xFF06B6D4), width: 2)
            : Border.all(color: Colors.grey[200]!),
        borderRadius: BorderRadius.circular(16),
        color: Colors.white,
        boxShadow: isPrimary
            ? [
                BoxShadow(
                  color: const Color(0xFF06B6D4).withOpacity(0.1),
                  blurRadius: 20,
                )
              ]
            : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: GoogleFonts.manrope(
                          fontSize: 18, fontWeight: FontWeight.w700)),
                  if (subtitle != null)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFF06B6D4),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(subtitle,
                          style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white)),
                    ),
                ],
              ),
              Text(price,
                  style: GoogleFonts.manrope(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF00687a))),
            ],
          ),
          const SizedBox(height: 16),
          ...features.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle,
                        size: 18, color: Color(0xFF06B6D4)),
                    const SizedBox(width: 8),
                    Text(f,
                        style: GoogleFonts.inter(
                            fontSize: 13)),
                  ],
                ),
              )),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: isLoading ? null : onTap,
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  isPrimary ? const Color(0xFF06B6D4) : Colors.grey[200],
              foregroundColor: isPrimary ? Colors.white : Colors.black,
              minimumSize: const Size(double.infinity, 48),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : Text(
                    isPrimary ? 'Denemeyi Başlat' : 'Planı Seç',
                    style: GoogleFonts.manrope(
                        fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}

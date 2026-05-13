import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:retina_ai_app/core/providers/auth_provider.dart';

/// Tüm ana ekranlarda kullanılan standart uygulama başlık çubuğu.
/// Logo (dairesel ikon) + RETINA KLİNİK / alt başlık + zil + avatar içerir.
class ClinicAppHeader extends ConsumerWidget {
  const ClinicAppHeader({super.key});

  static const _primary = Color(0xFF00687A);
  static const _accent = Color(0xFF00B4D8);
  static const _dark = Color(0xFF0D1B2A);
  static const _sub = Color(0xFF7A8694);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doctor = ref.watch(authProvider).doctor;
    final initial = doctor != null && doctor.name.isNotEmpty
        ? doctor.name[0].toUpperCase()
        : '?';

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 10),
      child: Row(
        children: [
          // ── Dairesel logo ikonu ─────────────────────────
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_accent, _primary],
              ),
              boxShadow: [
                BoxShadow(
                  color: _primary.withOpacity(0.28),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: SvgPicture.asset(
                'retina-ai.svg',
                width: 22,
                height: 22,
                colorFilter: const ColorFilter.mode(
                  Colors.white,
                  BlendMode.srcIn,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          // ── Metin grubu ────────────────────────────────
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              RichText(
                text: TextSpan(
                  children: [
                    TextSpan(
                      text: 'RETINA ',
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: _primary,
                        letterSpacing: 0.2,
                      ),
                    ),
                    TextSpan(
                      text: 'KLİNİK',
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: _dark,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                'FUNDUS KLİNİK TAKİP SİSTEMİ',
                style: GoogleFonts.inter(
                  fontSize: 8.5,
                  fontWeight: FontWeight.w600,
                  color: _sub,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          const Spacer(),
          // ── Zil ────────────────────────────────────────
          IconButton(
            onPressed: () => context.push('/notifications'),
            splashRadius: 18,
            icon: const Icon(Icons.notifications_none_rounded),
            color: const Color(0xFF64748B),
            iconSize: 20,
          ),
          // ── Avatar ─────────────────────────────────────
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _primary.withOpacity(0.12),
              border: Border.all(color: _primary.withOpacity(0.30), width: 1.6),
            ),
            child: Center(
              child: Text(
                initial,
                style: GoogleFonts.manrope(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: _primary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sayfanın üst kısmındaki başlık + açıklama kartı.
/// Raporlar sayfasındaki `_HeaderCard` stilinde, tüm sayfalarda tutarlılık için.
class ClinicPageTitleCard extends StatelessWidget {
  const ClinicPageTitleCard({
    super.key,
    required this.title,
    required this.subtitle,
    this.accentColor = const Color(0xFF00687A),
  });

  final String title;
  final String subtitle;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.manrope(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: GoogleFonts.inter(
              fontSize: 12.5,
              color: const Color(0xFF475569),
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final notifications = [
      _NotificationItem(
        title: 'Yeni hasta kaydı tamamlandı',
        subtitle: 'Ayşe K. için hasta kartı oluşturuldu.',
        time: '5 dk önce',
        icon: Icons.person_add_alt_1_rounded,
        color: const Color(0xFF00687A),
        onTap: () => context.push('/patients/recent'),
      ),
      _NotificationItem(
        title: 'Yüksek risk uyarısı',
        subtitle: 'Ali Kaya için hızlı müdahale önerildi.',
        time: '18 dk önce',
        icon: Icons.priority_high_rounded,
        color: const Color(0xFFBA1A1A),
        onTap: () => context.go('/patients?filter=high-risk'),
      ),
      _NotificationItem(
        title: 'AI analiz sonucu hazır',
        subtitle: 'Yeni rapor için AI özetini kontrol edebilirsiniz.',
        time: '1 saat önce',
        icon: Icons.psychology_alt_rounded,
        color: const Color(0xFF005D90),
        onTap: () => context.go('/reports'),
      ),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FB),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  const Icon(
                    Icons.notifications_active_outlined,
                    color: Color(0xFF005D90),
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Bildirimler',
                    style: GoogleFonts.manrope(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF111827),
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => context.go('/home'),
                    child: Text(
                      'Ana Sayfa',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF005D90),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  Text(
                    'Sistem ve klinik akışla ilgili son bildirimleri burada görebilirsiniz.',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: const Color(0xFF4B5563),
                    ),
                  ),
                  const SizedBox(height: 16),
                  ...notifications.map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _NotificationCard(item: item),
                    ),
                  ),
                ],
              ),
            ),
            const ClinicBottomNav(selectedTab: ClinicBottomTab.panel),
          ],
        ),
      ),
    );
  }
}

class _NotificationItem {
  const _NotificationItem({
    required this.title,
    required this.subtitle,
    required this.time,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String time;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item});

  final _NotificationItem item;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: item.onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE5E7EB)),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: item.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(item.icon, color: item.color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: GoogleFonts.manrope(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 12.5,
                        height: 1.4,
                        color: const Color(0xFF4B5563),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item.time,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF6B7280),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

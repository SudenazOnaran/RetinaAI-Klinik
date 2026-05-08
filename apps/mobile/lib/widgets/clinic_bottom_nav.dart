import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../core/providers/auth_provider.dart';

/// Spec §11.2 & §11.4 — role-aware bottom navigation.
/// DOCTOR/ASSISTANT/MANAGER/AUDITOR: Panel | Hastalar | Analiz | Raporlar | Profil
/// ADMIN: Admin Panel | Profil
enum ClinicBottomTab { panel, patients, analysis, reports, profile, admin }

class ClinicBottomNav extends ConsumerWidget {
  const ClinicBottomNav({Key? key, required this.selectedTab})
    : super(key: key);

  final ClinicBottomTab selectedTab;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(authProvider).doctor?.role ?? 'DOCTOR';
    final isAdmin = role == 'ADMIN';
    final isAuditor = role == 'AUDITOR';
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final safeBottom = bottomInset > 0 ? bottomInset : 24.0;

    final tabs = isAdmin
        ? _adminTabs(context)
        : _clinicTabs(context, role, isAuditor);

    return Container(
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(0, 93, 144, 0.08),
            blurRadius: 40,
            spreadRadius: -10,
            offset: Offset(0, -10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            color: Colors.white.withOpacity(0.9),
            padding: EdgeInsets.fromLTRB(16, 12, 16, safeBottom),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: tabs,
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _clinicTabs(BuildContext context, String role, bool isAuditor) {
    final canAccessPatients =
        role == 'DOCTOR' || role == 'ASSISTANT' || role == 'MANAGER';
    return [
      _NavItem(
        label: 'PANEL',
        icon: Icons.dashboard_outlined,
        activeIcon: Icons.dashboard_rounded,
        active: selectedTab == ClinicBottomTab.panel,
        onTap: () => _goTo(context, '/home'),
      ),
      if (canAccessPatients)
        _NavItem(
          label: 'HASTALAR',
          icon: Icons.group_outlined,
          activeIcon: Icons.group_rounded,
          active: selectedTab == ClinicBottomTab.patients,
          onTap: () => _goTo(context, '/patients'),
        ),
      if (canAccessPatients)
        _NavItem(
          label: 'ANALİZ',
          icon: Icons.biotech_outlined,
          activeIcon: Icons.biotech_rounded,
          active: selectedTab == ClinicBottomTab.analysis,
          onTap: () => _goTo(context, '/analysis'),
        ),
      _NavItem(
        label: 'RAPORLAR',
        icon: Icons.description_outlined,
        activeIcon: Icons.description_rounded,
        active: selectedTab == ClinicBottomTab.reports,
        onTap: () => _goTo(context, '/reports'),
      ),
      _NavItem(
        label: 'PROFİL',
        icon: Icons.person_outline_rounded,
        activeIcon: Icons.person_rounded,
        active: selectedTab == ClinicBottomTab.profile,
        onTap: () => _goTo(context, '/profile'),
      ),
    ];
  }

  List<Widget> _adminTabs(BuildContext context) {
    return [
      _NavItem(
        label: 'ADMİN',
        icon: Icons.admin_panel_settings_outlined,
        activeIcon: Icons.admin_panel_settings_rounded,
        active: selectedTab == ClinicBottomTab.admin,
        onTap: () => _goTo(context, '/admin'),
      ),
      _NavItem(
        label: 'PROFİL',
        icon: Icons.person_outline_rounded,
        activeIcon: Icons.person_rounded,
        active: selectedTab == ClinicBottomTab.profile,
        onTap: () => _goTo(context, '/profile'),
      ),
    ];
  }

  void _goTo(BuildContext context, String route) {
    if (GoRouterState.of(context).uri.path == route) return;
    context.go(route);
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.active,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final IconData activeIcon;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color textColor = active
        ? const Color(0xFF075985)
        : const Color(0xFF94A3B8);
    final Color bgColor = active ? const Color(0xFFE0F2FE) : Colors.transparent;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16), // rounded-2xl
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(active ? activeIcon : icon, size: 20, color: textColor),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 9,
                fontWeight: FontWeight.bold,
                letterSpacing: 0,
                color: textColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

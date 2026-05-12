import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:retina_ai_app/core/providers/auth_provider.dart';
import 'package:retina_ai_app/core/providers/patient_api_provider.dart';
import 'package:retina_ai_app/core/utils/risk_display_utils.dart';
import 'package:retina_ai_app/widgets/clinic_app_header.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';

class HomeDashboardScreen extends ConsumerWidget {
  const HomeDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doctor = ref.watch(authProvider).doctor;
    final doctorName = doctor?.fullName ?? 'Hoş Geldiniz';
    final patientState = ref.watch(patientApiProvider);
    final patients = patientState.patients;
    final totalPatients = patients.length;
    final highRiskCount = patients.where((p) => isHighRisk(p.risk)).length;
    final highRiskPatients = patients
        .where((p) => isHighRisk(p.risk))
        .take(2)
        .toList();
    final totalAnalyses = patients.fold<int>(
      0,
      (sum, p) => sum + (p.analysisCount ?? 0),
    );
    const background = Color(0xFFF2F4F7);
    const primary = Color(0xFF00687A);
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 390).clamp(0.82, 1.0);

    return Scaffold(
      backgroundColor: background,
      body: SafeArea(
        child: Column(
          children: [
            const ClinicAppHeader(),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  16 * scale,
                  14 * scale,
                  16 * scale,
                  104 * scale,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClinicPageTitleCard(
                      title: 'Hoş Geldiniz, $doctorName',
                      subtitle: highRiskCount > 0
                          ? '$highRiskCount yüksek riskli hasta takip gerektiriyor.'
                          : 'Klinik özet paneli üzerinden hasta sayısı, analiz yoğunluğu ve risk dağılımını tek bakışta görüntüleyebilirsiniz.',
                    ),
                    SizedBox(height: 14 * scale),
                    Row(
                      children: [
                        Expanded(
                          child: _TopActionButton(
                            icon: Icons.folder_rounded,
                            text: 'Hasta\nKayıtları',
                            filled: false,
                            scale: scale,
                            onTap: () => context.go('/patients'),
                          ),
                        ),
                        SizedBox(width: 10 * scale),
                        Expanded(
                          child: _TopActionButton(
                            icon: Icons.person_add_alt_1_rounded,
                            text: 'Yeni\nKayıt',
                            filled: true,
                            scale: scale,
                            onTap: () => context.push('/patients/new'),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 16 * scale),
                    GridView.count(
                      crossAxisCount: 2,
                      crossAxisSpacing: 10 * scale,
                      mainAxisSpacing: 10 * scale,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      childAspectRatio: 1.02,
                      children: [
                        _StatCard(
                          icon: Icons.groups_rounded,
                          iconBg: Color(0xFFE7F3FF),
                          iconColor: Color(0xFF005D90),
                          badge: '',
                          badgeColor: Color(0xFF94A3B8),
                          title: 'Toplam Hasta',
                          value: patientState.isLoading
                              ? '...'
                              : totalPatients.toString(),
                          scale: scale,
                        ),
                        _StatCard(
                          icon: Icons.warning_amber_rounded,
                          iconBg: Color(0xFFFFECE9),
                          iconColor: Color(0xFFBA1A1A),
                          badge: highRiskCount > 0 ? 'DİKKAT' : 'NORMAL',
                          badgeColor: highRiskCount > 0
                              ? Color(0xFFBA1A1A)
                              : Color(0xFF006645),
                          title: 'Yüksek Risk',
                          value: patientState.isLoading
                              ? '...'
                              : highRiskCount.toString(),
                          scale: scale,
                        ),
                        _StatCard(
                          icon: Icons.bar_chart_rounded,
                          iconBg: Color(0xFFE7FFF3),
                          iconColor: Color(0xFF006645),
                          badge: '',
                          badgeColor: Color(0xFF94A3B8),
                          title: 'Toplam Analiz',
                          value: patientState.isLoading
                              ? '...'
                              : totalAnalyses.toString(),
                          scale: scale,
                        ),
                        _StatCard(
                          icon: Icons.storage_rounded,
                          iconBg: Color(0xFFEAFBFF),
                          iconColor: Color(0xFF00677D),
                          badge: 'AKTİF',
                          badgeColor: Color(0xFF006645),
                          title: 'Sistem Durumu',
                          value: 'Stabil',
                          showDot: true,
                          scale: scale,
                        ),
                      ],
                    ),
                    SizedBox(height: 18 * scale),
                    _SectionTitle(
                      title: 'Son Kaydedilen Hastalar',
                      actionText: 'Tümünü Gör',
                      scale: scale,
                      onTap: () => context.push('/patients/recent'),
                    ),
                    SizedBox(height: 8 * scale),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8EE)),
                      ),
                      child: Column(
                        children: [
                          _TableHeader(scale: scale),
                          if (patientState.isLoading)
                            Padding(
                              padding: EdgeInsets.all(16 * scale),
                              child: const Center(
                                child: CircularProgressIndicator(),
                              ),
                            )
                          else if (patients.isEmpty)
                            Padding(
                              padding: EdgeInsets.all(16 * scale),
                              child: Text(
                                'Henüz kayıtlı hasta yok.',
                                style: GoogleFonts.inter(
                                  fontSize: 13 * scale,
                                  color: const Color(0xFF6B7280),
                                ),
                              ),
                            )
                          else
                            ...(() {
                              final recent = patients.take(4).toList();
                              final rows = <Widget>[];
                              for (int i = 0; i < recent.length; i++) {
                                final p = recent[i];
                                if (i > 0) {
                                  rows.add(
                                    const Divider(
                                      height: 1,
                                      color: Color(0xFFE8ECF1),
                                    ),
                                  );
                                }
                                final tc = p.tcNo;
                                final masked = tc.length >= 7
                                    ? '${tc.substring(0, 3)}****${tc.substring(tc.length - 4)}'
                                    : tc;
                                final d = p.createdAt;
                                final dateStr =
                                    '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
                                final nameParts = p.fullName.split(' ');
                                final displayName = nameParts.length >= 2
                                    ? '${nameParts.first}\n${nameParts.sublist(1).join(' ')}'
                                    : p.fullName;
                                rows.add(
                                  _PatientRow(
                                    name: displayName,
                                    id: masked,
                                    date: dateStr,
                                    scale: scale,
                                  ),
                                );
                              }
                              return rows;
                            })(),
                        ],
                      ),
                    ),
                    SizedBox(height: 18 * scale),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Kritik Risk İzleme',
                          style: GoogleFonts.manrope(
                            fontSize: 16 * scale,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF111827),
                          ),
                        ),
                        Icon(
                          Icons.priority_high_rounded,
                          color: Color(0xFFBA1A1A),
                          size: 16 * scale,
                        ),
                      ],
                    ),
                    SizedBox(height: 8 * scale),
                    Container(
                      padding: EdgeInsets.all(10 * scale),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF2F4F6),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8EE)),
                      ),
                      child: Column(
                        children: [
                          if (highRiskPatients.isEmpty)
                            Padding(
                              padding: EdgeInsets.symmetric(
                                vertical: 10 * scale,
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    Icons.check_circle_outline_rounded,
                                    color: const Color(0xFF006645),
                                    size: 16 * scale,
                                  ),
                                  SizedBox(width: 8 * scale),
                                  Text(
                                    'Yüksek riskli hasta bulunmuyor.',
                                    style: GoogleFonts.inter(
                                      fontSize: 13 * scale,
                                      color: const Color(0xFF006645),
                                    ),
                                  ),
                                ],
                              ),
                            )
                          else
                            ...(() {
                              final items = <Widget>[];
                              for (
                                int i = 0;
                                i < highRiskPatients.length;
                                i++
                              ) {
                                final p = highRiskPatients[i];
                                if (i > 0) {
                                  items.add(SizedBox(height: 10 * scale));
                                }
                                final confidence =
                                    p.lastAnalysis?.confidence ?? 0.8;
                                final percent = (confidence * 100)
                                    .round()
                                    .clamp(1, 100);
                                items.add(
                                  _RiskItem(
                                    name: p.fullName,
                                    subtitle: p.risk,
                                    percent: percent,
                                    scale: scale,
                                  ),
                                );
                              }
                              return items;
                            })(),
                          SizedBox(height: 12 * scale),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () =>
                                  context.go('/patients?filter=high-risk'),
                              style: ElevatedButton.styleFrom(
                                elevation: 0,
                                backgroundColor: const Color(0xFFFAD1CC),
                                foregroundColor: const Color(0xFF93000A),
                                minimumSize: Size.fromHeight(40 * scale),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: Text(
                                'Hızlı Müdahale Gerekenleri Gör',
                                style: GoogleFonts.inter(
                                  fontSize: 12 * scale,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      extendBody: true,
      bottomNavigationBar: const ClinicBottomNav(
        selectedTab: ClinicBottomTab.panel,
      ),
    );
  }
}

class _TopActionButton extends StatelessWidget {
  final IconData icon;
  final String text;
  final bool filled;
  final double scale;
  final VoidCallback onTap;

  const _TopActionButton({
    required this.icon,
    required this.text,
    required this.filled,
    required this.scale,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF00687A);
    const accent = Color(0xFF0EA7C7);

    final textColor = filled ? Colors.white : primary;

    return Container(
      decoration: BoxDecoration(
        color: filled ? null : const Color(0xFFE6E8EA),
        gradient: filled
            ? const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [primary, accent],
              )
            : null,
        borderRadius: BorderRadius.circular(14),
        boxShadow: filled
            ? [
                BoxShadow(
                  color: primary.withValues(alpha: 0.24),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: EdgeInsets.symmetric(
              vertical: 10 * scale,
              horizontal: 8 * scale,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, color: textColor, size: 16 * scale),
                SizedBox(width: 6 * scale),
                Text(
                  text,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 12 * scale,
                    fontWeight: FontWeight.w700,
                    color: textColor,
                    height: 1.15,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;
  final String actionText;
  final double scale;
  final VoidCallback onTap;

  const _SectionTitle({
    required this.title,
    required this.actionText,
    required this.scale,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: GoogleFonts.manrope(
            fontSize: 15 * scale,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF111827),
          ),
        ),
        TextButton(
          onPressed: onTap,
          child: Text(
            actionText,
            style: GoogleFonts.inter(
              fontSize: 12 * scale,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF00687A),
            ),
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final Color iconBg;
  final Color iconColor;
  final String badge;
  final Color badgeColor;
  final String title;
  final String value;
  final double scale;
  final bool showDot;

  const _StatCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.badge,
    required this.badgeColor,
    required this.title,
    required this.value,
    required this.scale,
    this.showDot = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(12 * scale),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(7 * scale),
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: iconColor, size: 16 * scale),
              ),
              const Spacer(),
              if (showDot) ...[
                Container(
                  width: 7,
                  height: 7,
                  decoration: const BoxDecoration(
                    color: Color(0xFF006645),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 5),
              ],
              Text(
                badge,
                style: GoogleFonts.inter(
                  fontSize: 10 * scale,
                  fontWeight: FontWeight.w700,
                  color: badgeColor,
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 12 * scale,
              fontWeight: FontWeight.w500,
              color: const Color(0xFF5C647A),
            ),
          ),
          SizedBox(height: 4 * scale),
          Text(
            value,
            style: GoogleFonts.manrope(
              fontSize: 20 * scale,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF191C1E),
            ),
          ),
        ],
      ),
    );
  }
}

class _TableHeader extends StatelessWidget {
  final double scale;

  const _TableHeader({required this.scale});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 12 * scale,
        vertical: 10 * scale,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFFF2F4F6),
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              'AD SOYAD',
              style: GoogleFonts.inter(
                fontSize: 10 * scale,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF3D4957),
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              'T.C. KİMLİK',
              style: GoogleFonts.inter(
                fontSize: 10 * scale,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF3D4957),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              'TARİH',
              style: GoogleFonts.inter(
                fontSize: 10 * scale,
                letterSpacing: 1,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF3D4957),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PatientRow extends StatelessWidget {
  final String name;
  final String id;
  final String date;
  final double scale;

  const _PatientRow({
    required this.name,
    required this.id,
    required this.date,
    required this.scale,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: 12 * scale,
        vertical: 10 * scale,
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              name,
              style: GoogleFonts.manrope(
                fontSize: 14 * scale,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF191C1E),
                height: 1.2,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              id,
              style: GoogleFonts.inter(
                fontSize: 12 * scale,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF404850),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              date,
              style: GoogleFonts.inter(
                fontSize: 12 * scale,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF404850),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RiskItem extends StatelessWidget {
  final String name;
  final String subtitle;
  final int percent;
  final double scale;

  const _RiskItem({
    required this.name,
    required this.subtitle,
    required this.percent,
    required this.scale,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 36 * scale,
              height: 36 * scale,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                gradient: const RadialGradient(
                  colors: [Color(0xFFD1D5DB), Color(0xFF6B7280)],
                ),
              ),
            ),
            Positioned(
              top: -2,
              right: -2,
              child: Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  color: const Color(0xFFBA1A1A),
                  border: Border.all(color: Colors.white, width: 2),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ],
        ),
        SizedBox(width: 8 * scale),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      name,
                      style: GoogleFonts.manrope(
                        fontSize: 14 * scale,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF191C1E),
                      ),
                    ),
                  ),
                  Text(
                    '%$percent',
                    style: GoogleFonts.inter(
                      fontSize: 13 * scale,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFFBA1A1A),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 2 * scale),
              Text(
                subtitle,
                style: GoogleFonts.inter(
                  fontSize: 11 * scale,
                  fontWeight: FontWeight.w500,
                  color: const Color(0xFF404850),
                ),
              ),
              SizedBox(height: 7 * scale),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: percent / 100,
                  minHeight: 4 * scale,
                  backgroundColor: const Color(0xFFE5E7EB),
                  valueColor: const AlwaysStoppedAnimation<Color>(
                    Color(0xFFBA1A1A),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

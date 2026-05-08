import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../theme/app_theme.dart';
import '../../widgets/section_container.dart';

/// Raporlar (Reports) — minimal but functional list view.
///
/// Displays a list of clinical reports with status indicators.
/// Uses surface layering, soft shadows, no borders.
class ReportsScreen extends StatelessWidget {
  const ReportsScreen({Key? key}) : super(key: key);

  static const List<_ReportItem> _reports = [
    _ReportItem(
      title: 'Diyabetik Retinopati Takip Raporu',
      patient: 'Ayşe Yılmaz',
      date: '12.10.2023',
      status: 'Kritik',
      statusColor: Color(0xFFBA1A1A),
      statusBg: Color(0xFFFFDAD6),
    ),
    _ReportItem(
      title: 'Katarakt Değerlendirme',
      patient: 'Mehmet Öztürk',
      date: '08.10.2023',
      status: 'Normal',
      statusColor: Color(0xFF006645),
      statusBg: Color(0xFFE8F5E9),
    ),
    _ReportItem(
      title: 'Glokom Tarama Raporu',
      patient: 'Zeynep Can',
      date: '15.09.2023',
      status: 'İşleniyor',
      statusColor: Color(0xFF005D90),
      statusBg: Color(0xFFE7F3FF),
    ),
    _ReportItem(
      title: 'Makula Dejenerasyonu Analizi',
      patient: 'Ali Kaya',
      date: '28.09.2023',
      status: 'Kritik',
      statusColor: Color(0xFFBA1A1A),
      statusBg: Color(0xFFFFDAD6),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  SvgPicture.asset(
                    'retina-ai.svg',
                    width: 22,
                    height: 22,
                    colorFilter: const ColorFilter.mode(
                      AppColors.primary,
                      BlendMode.srcIn,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'RETINA KLİNİK',
                    style: GoogleFonts.manrope(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: AppColors.primary,
                      letterSpacing: 0.2,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: AppColors.primary.withOpacity(0.24),
                        width: 1.4,
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: const Icon(
                      Icons.person,
                      size: 18,
                      color: Color(0xFF5C6470),
                    ),
                  ),
                ],
              ),
            ),
            // Content
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 140),
                children: [
                  Text(
                    'Klinik Raporlar',
                    style: GoogleFonts.manrope(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: AppColors.onSurface,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Hasta raporlarını görüntüleyin ve yönetin.',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.secondary,
                    ),
                  ),
                  const SizedBox(height: 20),
                  ..._reports.map(
                    (r) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: _ReportCard(report: r),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final _ReportItem report;

  const _ReportCard({required this.report});

  @override
  Widget build(BuildContext context) {
    return SectionContainer(
      color: AppColors.surfaceContainerLowest,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  report.title,
                  style: GoogleFonts.manrope(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Icon(
                      Icons.person_outline,
                      size: 14,
                      color: AppColors.outline,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      report.patient,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.secondary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Icon(
                      Icons.calendar_today_outlined,
                      size: 12,
                      color: AppColors.outline,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      report.date,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: AppColors.secondary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: report.statusBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              report.status,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: report.statusColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportItem {
  final String title;
  final String patient;
  final String date;
  final String status;
  final Color statusColor;
  final Color statusBg;

  const _ReportItem({
    required this.title,
    required this.patient,
    required this.date,
    required this.status,
    required this.statusColor,
    required this.statusBg,
  });
}

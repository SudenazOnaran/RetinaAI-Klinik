import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:retina_ai_app/widgets/clinic_app_header.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final _searchController = TextEditingController();
  final _minReportController = TextEditingController(text: '1');
  final _startDateController = TextEditingController(text: 'gg.aa.yyyy');
  final _endDateController = TextEditingController(text: 'gg.aa.yyyy');

  int _pageSize = 10;

  final List<_ReportSummary> _summaries = const [
    _ReportSummary(
      patientName: 'Ece KARAALP',
      tc: '12345678901',
      lastReportDate: '27.04.2026',
      reportCount: 2,
    ),
  ];

  @override
  void dispose() {
    _searchController.dispose();
    _minReportController.dispose();
    _startDateController.dispose();
    _endDateController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 390).clamp(0.86, 1.0);

    return Scaffold(
      backgroundColor: const Color(0xFFF3F6FA),
      body: SafeArea(
        child: Column(
          children: [
            const ClinicAppHeader(),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  16 * scale,
                  16 * scale,
                  16 * scale,
                  120 * scale,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ClinicPageTitleCard(
                      title: 'Rapor Yönetimi',
                      subtitle:
                          'Tüm hastaların genel rapor özetini görüntüleyebilir, ilgili hastanın rapor geçmişine hızlıca geçebilirsiniz.',
                    ),
                    SizedBox(height: 16 * scale),
                    _ReportsPanel(
                      scale: scale,
                      summaries: _summaries,
                      searchController: _searchController,
                      minReportController: _minReportController,
                      startDateController: _startDateController,
                      endDateController: _endDateController,
                    ),
                    SizedBox(height: 16 * scale),
                    _PaginationBar(
                      scale: scale,
                      pageSize: _pageSize,
                      onPageSizeChanged: (value) {
                        setState(() => _pageSize = value);
                      },
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
        selectedTab: ClinicBottomTab.reports,
      ),
    );
  }
}

class _ReportsPanel extends StatelessWidget {
  const _ReportsPanel({
    required this.scale,
    required this.summaries,
    required this.searchController,
    required this.minReportController,
    required this.startDateController,
    required this.endDateController,
  });

  final double scale;
  final List<_ReportSummary> summaries;
  final TextEditingController searchController;
  final TextEditingController minReportController;
  final TextEditingController startDateController;
  final TextEditingController endDateController;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16 * scale),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.description_outlined,
                color: Color(0xFF0284C7),
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                'Genel Hasta Raporları',
                style: GoogleFonts.manrope(
                  fontSize: 16 * scale,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Gelişmiş filtreleme ve sayfalama ile hasta bazlı rapor yönetimi',
            style: GoogleFonts.inter(
              fontSize: 12 * scale,
              color: const Color(0xFF64748B),
            ),
          ),
          SizedBox(height: 16 * scale),
          _FiltersBlock(
            scale: scale,
            searchController: searchController,
            minReportController: minReportController,
            startDateController: startDateController,
            endDateController: endDateController,
          ),
          SizedBox(height: 12 * scale),
          Row(
            children: [
              Text(
                'Toplam hasta: ${summaries.length}',
                style: GoogleFonts.inter(
                  fontSize: 12.5 * scale,
                  color: const Color(0xFF64748B),
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: () {},
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                icon: const Icon(Icons.download_rounded, size: 18),
                label: Text(
                  'CSV Dışa Aktar',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          SizedBox(height: 16 * scale),
          _TableHeader(scale: scale, total: summaries.length),
          const SizedBox(height: 8),
          ...summaries.map(
            (summary) => _ReportRow(scale: scale, summary: summary),
          ),
        ],
      ),
    );
  }
}

class _FiltersBlock extends StatelessWidget {
  const _FiltersBlock({
    required this.scale,
    required this.searchController,
    required this.minReportController,
    required this.startDateController,
    required this.endDateController,
  });

  final double scale;
  final TextEditingController searchController;
  final TextEditingController minReportController;
  final TextEditingController startDateController;
  final TextEditingController endDateController;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(12 * scale),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          _FilterField(
            label: 'Hasta Arama',
            hint: 'Hasta adı veya T.C. ile ara',
            icon: Icons.search,
            controller: searchController,
            scale: scale,
          ),
          SizedBox(height: 12 * scale),
          Row(
            children: [
              Expanded(
                child: _FilterField(
                  label: 'Minimum Rapor',
                  hint: '1',
                  icon: Icons.filter_alt_outlined,
                  controller: minReportController,
                  keyboardType: TextInputType.number,
                  scale: scale,
                ),
              ),
              SizedBox(width: 12 * scale),
              Expanded(
                child: _DateField(
                  label: 'Başlangıç Tarihi',
                  controller: startDateController,
                  scale: scale,
                ),
              ),
            ],
          ),
          SizedBox(height: 12 * scale),
          Row(
            children: [
              Expanded(
                child: _DateField(
                  label: 'Bitiş Tarihi',
                  controller: endDateController,
                  scale: scale,
                ),
              ),
              SizedBox(width: 12 * scale),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    searchController.clear();
                    minReportController.text = '1';
                    startDateController.text = 'gg.aa.yyyy';
                    endDateController.text = 'gg.aa.yyyy';
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF94A3B8),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    padding: EdgeInsets.symmetric(vertical: 14 * scale),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: Text(
                    'Filtreleri Sıfırla',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterField extends StatelessWidget {
  const _FilterField({
    required this.label,
    required this.hint,
    required this.icon,
    required this.controller,
    required this.scale,
    this.keyboardType,
  });

  final String label;
  final String hint;
  final IconData icon;
  final TextEditingController controller;
  final double scale;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 11 * scale,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType,
          decoration: InputDecoration(
            prefixIcon: Icon(icon, size: 18, color: const Color(0xFF94A3B8)),
            hintText: hint,
            hintStyle: GoogleFonts.inter(
              fontSize: 12.5 * scale,
              color: const Color(0xFF94A3B8),
            ),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding: EdgeInsets.symmetric(
              vertical: 12 * scale,
              horizontal: 12 * scale,
            ),
          ),
        ),
      ],
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    required this.label,
    required this.controller,
    required this.scale,
  });

  final String label;
  final TextEditingController controller;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 11 * scale,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          readOnly: true,
          decoration: InputDecoration(
            suffixIcon: const Icon(
              Icons.calendar_today_outlined,
              size: 16,
              color: Color(0xFF94A3B8),
            ),
            hintText: 'gg.aa.yyyy',
            hintStyle: GoogleFonts.inter(
              fontSize: 12.5 * scale,
              color: const Color(0xFF94A3B8),
            ),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding: EdgeInsets.symmetric(
              vertical: 12 * scale,
              horizontal: 12 * scale,
            ),
          ),
        ),
      ],
    );
  }
}

class _TableHeader extends StatelessWidget {
  const _TableHeader({required this.scale, required this.total});

  final double scale;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 12 * scale,
        vertical: 10 * scale,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Text(
            'Hasta bazlı genel rapor özeti',
            style: GoogleFonts.inter(
              fontSize: 12 * scale,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF334155),
            ),
          ),
          const Spacer(),
          Text(
            'Toplam sonuç: $total',
            style: GoogleFonts.inter(
              fontSize: 12 * scale,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF475569),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportRow extends StatelessWidget {
  const _ReportRow({required this.scale, required this.summary});

  final double scale;
  final _ReportSummary summary;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 12 * scale,
        vertical: 12 * scale,
      ),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: const Color(0xFFE2E8F0).withValues(alpha: 0.9),
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.description_outlined,
                size: 18,
                color: Color(0xFF64748B),
              ),
              SizedBox(width: 8 * scale),
              Expanded(
                child: Text(
                  summary.patientName,
                  style: GoogleFonts.manrope(
                    fontSize: 13.5 * scale,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111827),
                  ),
                ),
              ),
              OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.symmetric(
                    horizontal: 10 * scale,
                    vertical: 6 * scale,
                  ),
                  side: const BorderSide(color: Color(0xFF80CFF0)),
                  foregroundColor: const Color(0xFF007FA6),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Detay',
                      style: GoogleFonts.inter(
                        fontSize: 12 * scale,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.chevron_right_rounded, size: 16),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 8 * scale),
          _MetaRow(label: 'TC', value: summary.tc, scale: scale),
          _MetaRow(
            label: 'Son Rapor Tarihi',
            value: summary.lastReportDate,
            scale: scale,
          ),
          _MetaRow(
            label: 'Rapor Sayısı',
            value: summary.reportCount.toString(),
            scale: scale,
          ),
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.label,
    required this.value,
    required this.scale,
  });

  final String label;
  final String value;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: 4 * scale),
      child: Row(
        children: [
          SizedBox(
            width: 110 * scale,
            child: Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 12 * scale,
                color: const Color(0xFF64748B),
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 12 * scale,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF0F172A),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PaginationBar extends StatelessWidget {
  const _PaginationBar({
    required this.scale,
    required this.pageSize,
    required this.onPageSizeChanged,
  });

  final double scale;
  final int pageSize;
  final ValueChanged<int> onPageSizeChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(14 * scale),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Text(
                'Sayfa 1 / 1',
                style: GoogleFonts.inter(
                  fontSize: 12 * scale,
                  color: const Color(0xFF64748B),
                ),
              ),
              const Spacer(),
              Row(
                children: [
                  Text(
                    'Sayfa boyutu',
                    style: GoogleFonts.inter(
                      fontSize: 12 * scale,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(width: 8),
                  DropdownButton<int>(
                    value: pageSize,
                    items: const [10, 20, 30]
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text('$value'),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) onPageSizeChanged(value);
                    },
                  ),
                ],
              ),
            ],
          ),
          SizedBox(height: 12 * scale),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: null,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    foregroundColor: const Color(0xFF94A3B8),
                    padding: EdgeInsets.symmetric(vertical: 12 * scale),
                  ),
                  child: Text(
                    'Önceki',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              SizedBox(width: 12 * scale),
              Expanded(
                child: OutlinedButton(
                  onPressed: null,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    foregroundColor: const Color(0xFF94A3B8),
                    padding: EdgeInsets.symmetric(vertical: 12 * scale),
                  ),
                  child: Text(
                    'Sonraki',
                    style: GoogleFonts.inter(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReportSummary {
  const _ReportSummary({
    required this.patientName,
    required this.tc,
    required this.lastReportDate,
    required this.reportCount,
  });

  final String patientName;
  final String tc;
  final String lastReportDate;
  final int reportCount;
}

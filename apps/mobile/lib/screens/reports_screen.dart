import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:retina_ai_app/core/providers/patient_api_provider.dart';
import 'package:retina_ai_app/data/models/patient_api_model.dart';
import 'package:retina_ai_app/widgets/clinic_app_header.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  final _searchController = TextEditingController();
  final _minReportController = TextEditingController(text: '0');
  final _startDateController = TextEditingController();
  final _endDateController = TextEditingController();

  DateTime? _fromDate;
  DateTime? _toDate;
  int _pageSize = 10;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() => setState(() {}));
    _minReportController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchController.dispose();
    _minReportController.dispose();
    _startDateController.dispose();
    _endDateController.dispose();
    super.dispose();
  }

  List<PatientApiModel> _filterPatients(List<PatientApiModel> patients) {
    final query = _searchController.text.toLowerCase().trim();
    final minCount = int.tryParse(_minReportController.text.trim()) ?? 1;

    return patients.where((p) {
      // Search filter
      if (query.isNotEmpty) {
        final nameMatch = p.fullName.toLowerCase().contains(query);
        final tcMatch = (p.tcNo ?? '').contains(query);
        if (!nameMatch && !tcMatch) return false;
      }

      // Min report count filter
      final count = p.analysisCount ?? 0;
      if (minCount > 0 && count < minCount) return false;

      // Date range filter on last analysis
      if (_fromDate != null || _toDate != null) {
        final lastDate = p.lastAnalysis?.createdAt;
        if (lastDate == null) return false;
        if (_fromDate != null && lastDate.isBefore(_fromDate!)) return false;
        if (_toDate != null &&
            lastDate.isAfter(_toDate!.add(const Duration(days: 1))))
          return false;
      }

      return true;
    }).toList();
  }

  void _resetFilters() {
    setState(() {
      _searchController.clear();
      _minReportController.text = '0';
      _startDateController.clear();
      _endDateController.clear();
      _fromDate = null;
      _toDate = null;
      _currentPage = 0;
    });
  }

  Future<void> _pickStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _fromDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _fromDate = picked;
        _startDateController.text =
            '${picked.day.toString().padLeft(2, '0')}.${picked.month.toString().padLeft(2, '0')}.${picked.year}';
        _currentPage = 0;
      });
    }
  }

  Future<void> _pickEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _toDate ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _toDate = picked;
        _endDateController.text =
            '${picked.day.toString().padLeft(2, '0')}.${picked.month.toString().padLeft(2, '0')}.${picked.year}';
        _currentPage = 0;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final patientState = ref.watch(patientApiProvider);
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 390).clamp(0.86, 1.0);

    final allPatients = patientState.patients;
    final filtered = _filterPatients(allPatients);
    final totalPages = ((filtered.length - 1) ~/ _pageSize) + 1;
    final paginated = filtered
        .skip(_currentPage * _pageSize)
        .take(_pageSize)
        .toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF3F6FA),
      body: SafeArea(
        child: Column(
          children: [
            const ClinicAppHeader(),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
            Expanded(
              child: patientState.isLoading && allPatients.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : SingleChildScrollView(
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
                            patients: paginated,
                            totalFiltered: filtered.length,
                            searchController: _searchController,
                            minReportController: _minReportController,
                            startDateController: _startDateController,
                            endDateController: _endDateController,
                            onPickStartDate: _pickStartDate,
                            onPickEndDate: _pickEndDate,
                            onResetFilters: _resetFilters,
                            onExportCsv: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    'CSV dışa aktarma yakında.',
                                    style: GoogleFonts.inter(),
                                  ),
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                            },
                          ),
                          SizedBox(height: 16 * scale),
                          _PaginationBar(
                            scale: scale,
                            pageSize: _pageSize,
                            currentPage: _currentPage,
                            totalPages: totalPages,
                            onPageSizeChanged: (value) {
                              setState(() {
                                _pageSize = value;
                                _currentPage = 0;
                              });
                            },
                            onPrev: _currentPage > 0
                                ? () => setState(() => _currentPage--)
                                : null,
                            onNext: _currentPage < totalPages - 1
                                ? () => setState(() => _currentPage++)
                                : null,
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
    required this.patients,
    required this.totalFiltered,
    required this.searchController,
    required this.minReportController,
    required this.startDateController,
    required this.endDateController,
    required this.onPickStartDate,
    required this.onPickEndDate,
    required this.onResetFilters,
    required this.onExportCsv,
  });

  final double scale;
  final List<PatientApiModel> patients;
  final int totalFiltered;
  final TextEditingController searchController;
  final TextEditingController minReportController;
  final TextEditingController startDateController;
  final TextEditingController endDateController;
  final VoidCallback onPickStartDate;
  final VoidCallback onPickEndDate;
  final VoidCallback onResetFilters;
  final VoidCallback onExportCsv;

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
            onPickStartDate: onPickStartDate,
            onPickEndDate: onPickEndDate,
            onResetFilters: onResetFilters,
          ),
          SizedBox(height: 12 * scale),
          Row(
            children: [
              Text(
                'Toplam hasta: $totalFiltered',
                style: GoogleFonts.inter(
                  fontSize: 12.5 * scale,
                  color: const Color(0xFF64748B),
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: onExportCsv,
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0EA5E9),
                  foregroundColor: Colors.white,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                icon: const Icon(Icons.download_rounded, size: 16),
                label: Text(
                  'CSV',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                    color: Colors.white,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 16 * scale),
          _TableHeader(scale: scale, total: totalFiltered),
          const SizedBox(height: 8),
          if (patients.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  'Sonuç bulunamadı.',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
              ),
            )
          else
            ...patients.map(
              (patient) => _ReportRow(scale: scale, patient: patient),
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
    required this.onPickStartDate,
    required this.onPickEndDate,
    required this.onResetFilters,
  });

  final double scale;
  final TextEditingController searchController;
  final TextEditingController minReportController;
  final TextEditingController startDateController;
  final TextEditingController endDateController;
  final VoidCallback onPickStartDate;
  final VoidCallback onPickEndDate;
  final VoidCallback onResetFilters;

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
                  onTap: onPickStartDate,
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
                  onTap: onPickEndDate,
                ),
              ),
              SizedBox(width: 12 * scale),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onResetFilters,
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
    required this.onTap,
  });

  final String label;
  final TextEditingController controller;
  final double scale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasValue = controller.text.isNotEmpty;
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
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            width: double.infinity,
            padding: EdgeInsets.symmetric(
              vertical: 12 * scale,
              horizontal: 12 * scale,
            ),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    hasValue ? controller.text : 'gg.aa.yyyy',
                    style: GoogleFonts.inter(
                      fontSize: 12.5 * scale,
                      color: hasValue
                          ? const Color(0xFF0F172A)
                          : const Color(0xFF94A3B8),
                    ),
                  ),
                ),
                const Icon(
                  Icons.calendar_today_outlined,
                  size: 16,
                  color: Color(0xFF94A3B8),
                ),
              ],
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
  const _ReportRow({required this.scale, required this.patient});

  final double scale;
  final PatientApiModel patient;

  String _formatDate(DateTime? dt) {
    if (dt == null) return '-';
    return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
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
                  patient.fullName,
                  style: GoogleFonts.manrope(
                    fontSize: 13.5 * scale,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF111827),
                  ),
                ),
              ),
              OutlinedButton(
                onPressed: () =>
                    context.push('/patients/detail', extra: patient),
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
          _MetaRow(label: 'TC', value: patient.tcNo ?? '-', scale: scale),
          _MetaRow(
            label: 'Son Analiz Tarihi',
            value: _formatDate(patient.lastAnalysis?.createdAt),
            scale: scale,
          ),
          _MetaRow(
            label: 'Analiz Sayısı',
            value: (patient.analysisCount ?? 0).toString(),
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
    required this.currentPage,
    required this.totalPages,
    required this.onPageSizeChanged,
    required this.onPrev,
    required this.onNext,
  });

  final double scale;
  final int pageSize;
  final int currentPage;
  final int totalPages;
  final ValueChanged<int> onPageSizeChanged;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

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
                'Sayfa ${currentPage + 1} / ${totalPages == 0 ? 1 : totalPages}',
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
                  onPressed: onPrev,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    foregroundColor: onPrev != null
                        ? const Color(0xFF007FA6)
                        : const Color(0xFF94A3B8),
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
                  onPressed: onNext,
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    foregroundColor: onNext != null
                        ? const Color(0xFF007FA6)
                        : const Color(0xFF94A3B8),
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

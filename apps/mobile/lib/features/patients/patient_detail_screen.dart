import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'dart:io';
import 'dart:convert';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:dio/dio.dart';

import '../../data/models/patient_api_model.dart';
import '../../data/models/clinical_report_model.dart';
import '../../data/local/database/clinical_report_dao.dart';
import '../../data/local/database/analysis_dao.dart';
import '../../data/models/analysis_api_model.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../../services/analysis_service.dart';
import '../../core/utils/uuid_generator.dart';

class PatientDetailScreen extends StatefulWidget {
  const PatientDetailScreen({super.key, required this.patient});

  final PatientApiModel patient;

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen>
    with TickerProviderStateMixin {
  late final TabController _tabController;

  // Forma aktarılan AI özet metinleri
  String _fundusTransferText = '';
  String _octTransferText = '';
  String _ffaTransferText = '';

  List<ClinicalReportModel> _savedReports = [];
  List<AnalysisApiModel> _analyses = [];
  bool _savingReport = false;

  final _reportTitleController = TextEditingController();
  final _doctorController = TextEditingController();
  final _anamnesisController = TextEditingController();
  final _examController = TextEditingController();
  final _labController = TextEditingController();
  final _diagnosisController = TextEditingController();
  final _treatmentController = TextEditingController();
  final _doctorNotesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadSavedReports();
    _loadAnalyses();
  }

  Future<void> _loadAnalyses() async {
    final analyses = await AnalysisDao.instance.getByPatientId(
      widget.patient.id,
    );
    if (mounted) setState(() => _analyses = analyses);
  }

  Future<void> _loadSavedReports() async {
    final reports = await ClinicalReportDao.instance.getByPatientId(
      widget.patient.id,
    );
    if (mounted) setState(() => _savedReports = reports);
  }

  Future<void> _saveReport() async {
    setState(() => _savingReport = true);
    try {
      final allAiNotes = [
        if (_fundusTransferText.isNotEmpty) 'Fundus: $_fundusTransferText',
        if (_octTransferText.isNotEmpty) 'OCT: $_octTransferText',
        if (_ffaTransferText.isNotEmpty) 'FFA: $_ffaTransferText',
      ].join('\n');

      final report = ClinicalReportModel.create(
        patientId: widget.patient.id,
        title: _reportTitleController.text,
        doctorName: _doctorController.text,
        anamnesis: _anamnesisController.text,
        examFindings: _examController.text,
        labResults: _labController.text,
        diagnosis: _diagnosisController.text,
        treatment: _treatmentController.text,
        doctorNotes: _doctorNotesController.text,
        aiNotes: allAiNotes,
      );

      await ClinicalReportDao.instance.insert(report);
      await _loadSavedReports();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Rapor kaydedildi.', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFF1B5E20),
            behavior: SnackBarBehavior.floating,
          ),
        );
        // Raporlar sekmesine geç
        _tabController.animateTo(2);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Hata: $e', style: GoogleFonts.inter()),
            backgroundColor: const Color(0xFF93000A),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingReport = false);
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _reportTitleController.dispose();
    _doctorController.dispose();
    _anamnesisController.dispose();
    _examController.dispose();
    _labController.dispose();
    _diagnosisController.dispose();
    _treatmentController.dispose();
    _doctorNotesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const bg = Color(0xFFF3F6FA);
    const card = Colors.white;
    const border = Color(0xFFD7DFEA);
    const primary = Color(0xFF0A8FB6);

    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        backgroundColor: bg,
        elevation: 0,
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.patient.fullName,
              style: GoogleFonts.manrope(
                color: const Color(0xFF14243D),
                fontWeight: FontWeight.w800,
                fontSize: 18,
              ),
            ),
            Text(
              'T.C.: ${widget.patient.tcNo}',
              style: GoogleFonts.inter(
                color: const Color(0xFF5D6B82),
                fontWeight: FontWeight.w500,
                fontSize: 12,
              ),
            ),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          indicatorColor: primary,
          labelColor: primary,
          unselectedLabelColor: const Color(0xFF8B9BB4),
          labelStyle: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
          unselectedLabelStyle: GoogleFonts.inter(fontSize: 12),
          tabs: const [
            Tab(text: 'Rapor Oluştur'),
            Tab(text: 'AI Analiz'),
            Tab(text: 'Raporlar'),
            Tab(text: 'Radyolojik'),
            Tab(text: 'İlerleme'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Rapor Oluştur
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _panel(
                    card,
                    border,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.description_outlined,
                              color: primary,
                              size: 18,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Rapor Olustur',
                              style: GoogleFonts.manrope(
                                fontSize: 19,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF14243D),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Gorsel yukleme zorunlu degildir. Standart goz klinigi rapor alanlarini doldurarak rapor olusturabilirsiniz.',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: const Color(0xFF4D5D77),
                          ),
                        ),
                        const SizedBox(height: 12),
                        _aiAnalysisNavBanner(),
                        const SizedBox(height: 12),
                        _label('Rapor Başlığı'),
                        _input(
                          _reportTitleController,
                          hint: 'Göz Muayene Raporu',
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _label('Hasta Kimlik Bilgileri'),
                                  _readonlyInput(
                                    '${widget.patient.fullName} | T.C.: ${widget.patient.tcNo}',
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _label('Rapor Tarihi'),
                                  _readonlyInput(
                                    DateTime.now().toString().split(' ').first,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _label('Doktor Bilgisi'),
                        _input(_doctorController, hint: 'Dr. Adı Soyadı'),
                        const SizedBox(height: 10),
                        _label('Klinik Öykü (Anamnez)'),
                        _input(
                          _anamnesisController,
                          maxLines: 3,
                          hint:
                              'Hastanın şikayetı, semptom süresi, önceki tedavi öyküsü',
                        ),
                        const SizedBox(height: 10),
                        _label('Muayene Bulguları'),
                        _input(
                          _examController,
                          maxLines: 3,
                          hint:
                              'Görme keskinliği, biyomikroskopi, fundus muayenesi bulguları',
                        ),
                        const SizedBox(height: 10),
                        _label('Laboratuvar Sonuçları'),
                        _input(
                          _labController,
                          maxLines: 3,
                          hint:
                              'HbA1c, glukoz, lipid profili gibi laboratuvar bilgileri',
                        ),
                        const SizedBox(height: 10),
                        _label('Teşhis / Klinik Değerlendirme'),
                        _input(
                          _diagnosisController,
                          maxLines: 3,
                          hint: 'Klinik değerlendirme ve nihai tanı',
                        ),
                        const SizedBox(height: 10),
                        _label('Tedavi ve Öneriler'),
                        _input(
                          _treatmentController,
                          maxLines: 3,
                          hint:
                              'Tedavi planı, ilaç önerileri ve kontrol önerisi',
                        ),
                        const SizedBox(height: 10),
                        _label('Doktor Notları'),
                        _input(
                          _doctorNotesController,
                          maxLines: 3,
                          hint:
                              'Ek klinik notlar, özel uyarılar veya takip planı',
                        ),
                        if (_fundusTransferText.isNotEmpty ||
                            _octTransferText.isNotEmpty ||
                            _ffaTransferText.isNotEmpty)
                          ..._transferredResultBox(),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: primary,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            onPressed: _savingReport ? null : _saveReport,
                            child: _savingReport
                                ? const SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(
                                    'Raporu Kaydet',
                                    style: GoogleFonts.inter(
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
          // Tab 2: AI Analiz
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(12, 16, 12, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [_aiAnalysisPanel(card, border)],
              ),
            ),
          ),
          // Tab 3: Raporlar (klinik rapor geçmişi)
          SafeArea(
            child: _savedReports.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.description_outlined,
                            size: 56,
                            color: Color(0xFFB0BEC5),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Henüz klinik rapor bulunmuyor.',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Rapor Oluştur sekmesinden rapor kaydedebilirsiniz.',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF9CA3AF),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
                    itemCount: _savedReports.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final report = _savedReports[index];
                      return _ReportCard(report: report);
                    },
                  ),
          ),
          // Tab 4: Radyolojik Raporlar (AI analiz geçmişi)
          SafeArea(
            child: _analyses.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.biotech_outlined,
                            size: 56,
                            color: Color(0xFFB0BEC5),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Henüz radyolojik rapor bulunmuyor.',
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              color: const Color(0xFF6B7280),
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'AI Analiz sekmesinden görsel yükleyerek analiz başlatın.',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: const Color(0xFF9CA3AF),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  )
                : Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    child: ListView.separated(
                      itemCount: _analyses.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final analysis = _analyses[index];
                        return _RadiologyCard(
                          analysis: analysis,
                          onDeleted: _loadAnalyses,
                        );
                      },
                    ),
                  ),
          ),
          // Tab 5: İlerleme (DR progression)
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.show_chart_rounded,
                      size: 56,
                      color: Color(0xFFB0BEC5),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Yeterli veri bulunamadı.',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: const Color(0xFF6B7280),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'İlerleme grafiği görmek için en az 2 analiz gereklidir.',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: const Color(0xFF9CA3AF),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── AI Analiz Panel (Tab 2) ──────────────────────────────────────────────
  Widget _aiAnalysisPanel(Color card, Color border) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'AI Görüntü Analizi',
          style: GoogleFonts.manrope(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF14243D),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Fundus, OCT veya FFA görüntüsü yükleyin. Sonucu Rapor Oluştur sekmesine aktarabilirsiniz.',
          style: GoogleFonts.inter(
            fontSize: 13,
            color: const Color(0xFF4D5D77),
          ),
        ),
        const SizedBox(height: 16),
        _InlineAnalysisCard(
          icon: Icons.visibility_outlined,
          label: 'Fundus',
          subtitle: 'Retina fundus görüntüsü — DR evre tespiti',
          iconBg: const Color(0xFFE7F3FF),
          iconColor: const Color(0xFF005D90),
          apiEndpoint: ApiConstants.aiPredict,
          patientId: widget.patient.id,
          border: border,
          transferText: _fundusTransferText,
          onTransfer: (text) => setState(() => _fundusTransferText = text),
          onClearTransfer: () => setState(() => _fundusTransferText = ''),
          onAnalysisSaved: _loadAnalyses,
        ),
        const SizedBox(height: 12),
        _InlineAnalysisCard(
          icon: Icons.grid_view_rounded,
          label: 'OCT',
          subtitle: 'Makula OCT görüntüsü — katman analizi',
          iconBg: const Color(0xFFF0FFF4),
          iconColor: const Color(0xFF006645),
          apiEndpoint: ApiConstants.aiPredictOct,
          patientId: widget.patient.id,
          border: border,
          transferText: _octTransferText,
          onTransfer: (text) => setState(() => _octTransferText = text),
          onClearTransfer: () => setState(() => _octTransferText = ''),
          onAnalysisSaved: _loadAnalyses,
        ),
        const SizedBox(height: 12),
        _InlineAnalysisCard(
          icon: Icons.blur_on_rounded,
          label: 'FFA',
          subtitle: 'Flöresein anjiyografi — damar değerlendirmesi',
          iconBg: const Color(0xFFFFF8E7),
          iconColor: const Color(0xFF8B5000),
          apiEndpoint: ApiConstants.aiPredictFfa,
          patientId: widget.patient.id,
          border: border,
          transferText: _ffaTransferText,
          onTransfer: (text) => setState(() => _ffaTransferText = text),
          onClearTransfer: () => setState(() => _ffaTransferText = ''),
          onAnalysisSaved: _loadAnalyses,
        ),
        if (_fundusTransferText.isNotEmpty ||
            _octTransferText.isNotEmpty ||
            _ffaTransferText.isNotEmpty)
          ..._transferredResultBox(),
      ],
    );
  }

  Widget _panel(Color card, Color border, {required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: card,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: child,
    );
  }

  Widget _aiAnalysisNavBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFE1F5FE),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF81D4FA)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Fundus, OCT veya FFA görüntüsü yüklemek için:',
              style: GoogleFonts.inter(
                fontSize: 12,
                color: const Color(0xFF0277BD),
              ),
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () => _tabController.animateTo(1),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF0277BD),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: const BorderSide(color: Color(0xFF0277BD)),
              ),
            ),
            child: Text(
              'AI Analiz →',
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _transferredResultBox() {
    return [
      const SizedBox(height: 12),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFE8F5E9),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(0xFFA5D6A7)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.check_circle_rounded,
                  size: 16,
                  color: Color(0xFF2E7D32),
                ),
                const SizedBox(width: 6),
                Text(
                  'Forma aktarılan AI içeriği:',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1B5E20),
                  ),
                ),
              ],
            ),
            if (_fundusTransferText.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                'Fundus: $_fundusTransferText',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: const Color(0xFF1B5E20),
                  height: 1.4,
                ),
              ),
            ],
            if (_octTransferText.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'OCT: $_octTransferText',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: const Color(0xFF1B5E20),
                  height: 1.4,
                ),
              ),
            ],
            if (_ffaTransferText.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                'FFA: $_ffaTransferText',
                style: GoogleFonts.inter(
                  fontSize: 11,
                  color: const Color(0xFF1B5E20),
                  height: 1.4,
                ),
              ),
            ],
          ],
        ),
      ),
    ];
  }

  Widget _label(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontWeight: FontWeight.w600,
          color: const Color(0xFF2E3E56),
          fontSize: 12,
        ),
      ),
    );
  }

  Widget _input(
    TextEditingController controller, {
    int maxLines = 1,
    String? hint,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        hintText: hint,
        hintStyle: GoogleFonts.inter(
          fontSize: 13,
          color: const Color(0xFFB0BEC5),
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
      style: GoogleFonts.inter(fontSize: 13),
    );
  }

  Widget _readonlyInput(String text) {
    return TextField(
      enabled: false,
      controller: TextEditingController(text: text),
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      ),
      style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF3F4F66)),
    );
  }
}

class _ReportCard extends StatelessWidget {
  const _ReportCard({required this.report});
  final ClinicalReportModel report;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => _showDetail(context),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFD7DFEA)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.description_rounded,
                  size: 18,
                  color: Color(0xFF0A8FB6),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    report.title,
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: const Color(0xFF14243D),
                    ),
                  ),
                ),
                Text(
                  report.createdAtFormatted,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: Color(0xFF9CA3AF),
                ),
              ],
            ),
            if (report.diagnosis.isNotEmpty) ...[
              const SizedBox(height: 8),
              _row('Tanı', report.diagnosis),
            ],
            if (report.treatment.isNotEmpty) ...[
              const SizedBox(height: 4),
              _row('Tedavi', report.treatment),
            ],
            if (report.aiNotes.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFE8F5E9),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFA5D6A7)),
                ),
                child: Text(
                  'AI: ${report.aiNotes}',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: const Color(0xFF1B5E20),
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ClinicalReportDetailSheet(report: report),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 52,
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF64748B),
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFF1E293B),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Clinical Report Detail Bottom Sheet ────────────────────────────────────
class _ClinicalReportDetailSheet extends StatelessWidget {
  const _ClinicalReportDetailSheet({required this.report});
  final ClinicalReportModel report;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.88,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (ctx, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Icon(
                    Icons.description_rounded,
                    size: 20,
                    color: Color(0xFF0A8FB6),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      report.title,
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF14243D),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(20),
                children: [
                  _detailRow('Tarih', report.createdAtFormatted),
                  _detailRow('Doktor', report.doctorName),
                  if (report.anamnesis.isNotEmpty)
                    _detailSection('Anamnez', report.anamnesis),
                  if (report.examFindings.isNotEmpty)
                    _detailSection('Muayene Bulguları', report.examFindings),
                  if (report.labResults.isNotEmpty)
                    _detailSection('Laboratuvar', report.labResults),
                  if (report.diagnosis.isNotEmpty)
                    _detailSection('Tanı', report.diagnosis),
                  if (report.treatment.isNotEmpty)
                    _detailSection('Tedavi', report.treatment),
                  if (report.doctorNotes.isNotEmpty)
                    _detailSection('Doktor Notları', report.doctorNotes),
                  if (report.aiNotes.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE8F5E9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFA5D6A7)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'AI Notları',
                            style: GoogleFonts.manrope(
                              fontWeight: FontWeight.w700,
                              fontSize: 12,
                              color: const Color(0xFF1B5E20),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            report.aiNotes,
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: const Color(0xFF2E7D32),
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.picture_as_pdf_rounded),
                  label: const Text('PDF Olarak İndir'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD32F2F),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () => _downloadPdf(context),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _downloadPdf(BuildContext context) async {
    final fontRegular = await PdfGoogleFonts.notoSansRegular();
    final fontBold = await PdfGoogleFonts.notoSansBold();

    final doc = pw.Document();

    pw.TextStyle body(double size) =>
        pw.TextStyle(font: fontRegular, fontSize: size);
    pw.TextStyle bold(double size) => pw.TextStyle(
      font: fontBold,
      fontSize: size,
      fontWeight: pw.FontWeight.bold,
    );

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        theme: pw.ThemeData.withFont(base: fontRegular, bold: fontBold),
        build: (pw.Context ctx) => [
          pw.Header(
            level: 0,
            child: pw.Text('Klinik Rapor: ${report.title}', style: bold(18)),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            'Tarih: ${report.createdAtFormatted}   |   Doktor: ${report.doctorName}',
            style: body(11).copyWith(color: PdfColors.grey700),
          ),
          pw.Divider(),
          if (report.anamnesis.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('Anamnez', style: bold(13))),
            pw.Text(report.anamnesis, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.examFindings.isNotEmpty) ...[
            pw.Header(
              level: 1,
              child: pw.Text('Muayene Bulgulari', style: bold(13)),
            ),
            pw.Text(report.examFindings, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.labResults.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('Laboratuvar', style: bold(13))),
            pw.Text(report.labResults, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.diagnosis.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('Tani', style: bold(13))),
            pw.Text(report.diagnosis, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.treatment.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('Tedavi', style: bold(13))),
            pw.Text(report.treatment, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.doctorNotes.isNotEmpty) ...[
            pw.Header(
              level: 1,
              child: pw.Text('Doktor Notlari', style: bold(13)),
            ),
            pw.Text(report.doctorNotes, style: body(12)),
            pw.SizedBox(height: 8),
          ],
          if (report.aiNotes.isNotEmpty) ...[
            pw.Header(level: 1, child: pw.Text('AI Notlari', style: bold(13))),
            pw.Text(report.aiNotes, style: body(12)),
          ],
        ],
      ),
    );
    await Printing.layoutPdf(
      onLayout: (_) async => doc.save(),
      name: '${report.title}_${report.createdAtFormatted}.pdf',
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Text(
            '$label: ',
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: const Color(0xFF64748B),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 12,
                color: const Color(0xFF1E293B),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _detailSection(String title, String content) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: const Color(0xFF2E3E56),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            content,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: const Color(0xFF1E293B),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Radiology Card ──────────────────────────────────────────────────────────
class _RadiologyCard extends StatelessWidget {
  const _RadiologyCard({required this.analysis, required this.onDeleted});
  final AnalysisApiModel analysis;
  final VoidCallback onDeleted;

  static String _kindLabel(String? kind) {
    switch (kind?.toLowerCase()) {
      case 'oct':
        return 'OCT';
      case 'ffa':
        return 'FFA';
      default:
        return 'Fundus';
    }
  }

  static IconData _kindIcon(String? kind) {
    switch (kind?.toLowerCase()) {
      case 'oct':
        return Icons.grid_view_rounded;
      case 'ffa':
        return Icons.blur_on_rounded;
      default:
        return Icons.visibility_outlined;
    }
  }

  static Color _kindColor(String? kind) {
    switch (kind?.toLowerCase()) {
      case 'oct':
        return const Color(0xFF006645);
      case 'ffa':
        return const Color(0xFF8B5000);
      default:
        return const Color(0xFF005D90);
    }
  }

  String get _dateFormatted {
    final d = analysis.createdAt;
    return '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
  }

  String get _confidenceText {
    final pct = (analysis.confidence * 100).toStringAsFixed(1);
    return 'Güven: %$pct';
  }

  @override
  Widget build(BuildContext context) {
    final kind = analysis.reportKind;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => _showDetail(context),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFD7DFEA)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: _kindColor(kind).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(_kindIcon(kind), size: 22, color: _kindColor(kind)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_kindLabel(kind)} Analizi',
                    style: GoogleFonts.manrope(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: const Color(0xFF14243D),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    analysis.aiResult,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: const Color(0xFF1E293B),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _confidenceText,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  _dateFormatted,
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 4),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: Color(0xFF9CA3AF),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _RadiologyDetailSheet(analysis: analysis),
    );
  }
}

// ── Radiology Detail Bottom Sheet ──────────────────────────────────────────
class _RadiologyDetailSheet extends StatelessWidget {
  const _RadiologyDetailSheet({required this.analysis});
  final AnalysisApiModel analysis;

  String get _dateFormatted {
    final d = analysis.createdAt;
    return '${d.day.toString().padLeft(2, '0')}.${d.month.toString().padLeft(2, '0')}.${d.year}';
  }

  String _kindLabel(String? kind) {
    switch (kind?.toLowerCase()) {
      case 'oct':
        return 'OCT';
      case 'ffa':
        return 'FFA';
      default:
        return 'Fundus';
    }
  }

  @override
  Widget build(BuildContext context) {
    final pct = (analysis.confidence * 100).toStringAsFixed(1);
    final kind = _kindLabel(analysis.reportKind);
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (ctx, scrollController) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 10),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Icon(
                    Icons.biotech_outlined,
                    size: 20,
                    color: Color(0xFF0A8FB6),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '$kind Radyolojik Rapor',
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF14243D),
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.of(ctx).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.all(20),
                children: [
                  _item('Analiz Türü', kind),
                  _item('Tarih', _dateFormatted),
                  _item('AI Sonucu', analysis.aiResult),
                  _item('Güven Skoru', '%$pct'),
                  if (analysis.drFeedback != null &&
                      analysis.drFeedback!.isNotEmpty)
                    _item('DR Değerlendirmesi', analysis.drFeedback!),
                  if (analysis.doctorNote != null &&
                      analysis.doctorNote!.isNotEmpty)
                    _item('Doktor Notu', analysis.doctorNote!),
                  // ── Orijinal görsel ───────────────────────────────────────
                  if (analysis.originalImage != null &&
                      analysis.originalImage!.isNotEmpty &&
                      File(analysis.originalImage!).existsSync()) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Orijinal Görsel',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.file(
                        File(analysis.originalImage!),
                        width: double.infinity,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ],
                  // ── Heatmap görsel ────────────────────────────────────────
                  if (analysis.heatmapUrl != null &&
                      analysis.heatmapUrl!.isNotEmpty &&
                      analysis.heatmapUrl!.startsWith('/') &&
                      File(analysis.heatmapUrl!).existsSync()) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Isı Haritası (Heatmap)',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.file(
                        File(analysis.heatmapUrl!),
                        width: double.infinity,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  icon: const Icon(Icons.picture_as_pdf_rounded),
                  label: const Text('PDF Olarak İndir'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFD32F2F),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () => _downloadPdf(context),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _downloadPdf(BuildContext context) async {
    final pct = (analysis.confidence * 100).toStringAsFixed(1);
    final kind = _kindLabel(analysis.reportKind);

    // Türkçe karakter destekli fontlar (internet bağlantısı gerekir)
    final fontRegular = await PdfGoogleFonts.notoSansRegular();
    final fontBold = await PdfGoogleFonts.notoSansBold();

    // Görselleri yükle
    pw.MemoryImage? originalImg;
    pw.MemoryImage? heatmapImg;
    try {
      if (analysis.originalImage != null &&
          analysis.originalImage!.isNotEmpty &&
          File(analysis.originalImage!).existsSync()) {
        originalImg = pw.MemoryImage(
          await File(analysis.originalImage!).readAsBytes(),
        );
      }
    } catch (_) {}
    try {
      if (analysis.heatmapUrl != null &&
          analysis.heatmapUrl!.isNotEmpty &&
          analysis.heatmapUrl!.startsWith('/') &&
          File(analysis.heatmapUrl!).existsSync()) {
        heatmapImg = pw.MemoryImage(
          await File(analysis.heatmapUrl!).readAsBytes(),
        );
      }
    } catch (_) {}

    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        theme: pw.ThemeData.withFont(base: fontRegular, bold: fontBold),
        build: (pw.Context ctx) => [
          pw.Header(
            level: 0,
            child: pw.Text(
              'Radyolojik Rapor: $kind Analizi',
              style: pw.TextStyle(
                font: fontBold,
                fontSize: 18,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
          pw.SizedBox(height: 8),
          pw.Text(
            'Tarih: $_dateFormatted',
            style: pw.TextStyle(
              font: fontRegular,
              fontSize: 11,
              color: PdfColors.grey700,
            ),
          ),
          pw.Divider(),
          pw.Header(
            level: 1,
            child: pw.Text(
              'Analiz Sonucu',
              style: pw.TextStyle(font: fontBold),
            ),
          ),
          pw.Text(analysis.aiResult, style: pw.TextStyle(font: fontRegular)),
          pw.SizedBox(height: 8),
          pw.Header(
            level: 1,
            child: pw.Text('Güven Skoru', style: pw.TextStyle(font: fontBold)),
          ),
          pw.Text('%$pct', style: pw.TextStyle(font: fontRegular)),
          if (analysis.drFeedback != null &&
              analysis.drFeedback!.isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Header(
              level: 1,
              child: pw.Text(
                'DR Değerlendirmesi',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.Text(
              analysis.drFeedback!,
              style: pw.TextStyle(font: fontRegular),
            ),
          ],
          if (analysis.doctorNote != null &&
              analysis.doctorNote!.isNotEmpty) ...[
            pw.SizedBox(height: 8),
            pw.Header(
              level: 1,
              child: pw.Text(
                'Doktor Notu',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.Text(
              analysis.doctorNote!,
              style: pw.TextStyle(font: fontRegular),
            ),
          ],
          // Orijinal görsel
          if (originalImg != null) ...[
            pw.SizedBox(height: 16),
            pw.Header(
              level: 1,
              child: pw.Text(
                'Orijinal Görsel',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.SizedBox(height: 8),
            pw.Center(
              child: pw.Image(originalImg, height: 280, fit: pw.BoxFit.contain),
            ),
          ],
          // Heatmap
          if (heatmapImg != null) ...[
            pw.SizedBox(height: 16),
            pw.Header(
              level: 1,
              child: pw.Text(
                'Isı Haritası (Heatmap)',
                style: pw.TextStyle(font: fontBold),
              ),
            ),
            pw.SizedBox(height: 8),
            pw.Center(
              child: pw.Image(heatmapImg, height: 280, fit: pw.BoxFit.contain),
            ),
          ],
        ],
      ),
    );
    await Printing.layoutPdf(
      onLayout: (_) async => doc.save(),
      name: '${kind}_Analiz_$_dateFormatted.pdf',
    );
  }

  Widget _item(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.manrope(
              fontWeight: FontWeight.w700,
              fontSize: 12,
              color: const Color(0xFF64748B),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 13,
              color: const Color(0xFF1E293B),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Inline Analysis Card ────────────────────────────────────────────────────
// Her modality (Fundus/OCT/FFA) için ayrı state — görsel seçim, yükleme,
// sonuç gösterimi hepsi bu kartın içinde kalır, başka sayfaya geçilmez.
class _InlineAnalysisCard extends StatefulWidget {
  const _InlineAnalysisCard({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.iconBg,
    required this.iconColor,
    required this.apiEndpoint,
    required this.patientId,
    required this.border,
    required this.transferText,
    required this.onTransfer,
    required this.onClearTransfer,
    required this.onAnalysisSaved,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final Color iconBg;
  final Color iconColor;
  final String apiEndpoint;
  final String patientId;
  final Color border;
  final String transferText;
  final void Function(String text) onTransfer;
  final VoidCallback onClearTransfer;
  final VoidCallback onAnalysisSaved;

  @override
  State<_InlineAnalysisCard> createState() => _InlineAnalysisCardState();
}

class _InlineAnalysisCardState extends State<_InlineAnalysisCard> {
  static const _primary = Color(0xFF0A8FB6);

  XFile? _pickedImage;
  bool _analyzing = false;
  Map<String, dynamic>? _result;
  String? _errorMsg;

  String? get _aiLabel {
    if (_result == null) return null;
    final pytorch = _result!['pytorch'] as Map<String, dynamic>?;
    final label = pytorch?['label'] as String?;
    final confidence = (pytorch?['confidence'] as num?)?.toDouble() ?? 0.0;
    if (confidence < 0.75 || label == null) return 'Belirsiz';
    return label;
  }

  double get _confidence {
    final pytorch = _result?['pytorch'] as Map<String, dynamic>?;
    return ((pytorch?['confidence'] as num?) ?? 0.0).toDouble();
  }

  String? get _heatmapBase64 => _result?['heatmapPlus'] as String?;

  Future<void> _sendToApi(XFile image) async {
    try {
      setState(() {
        _analyzing = true;
        _errorMsg = null;
      });
      final formData = FormData.fromMap({
        'image': await MultipartFile.fromFile(
          image.path,
          filename: 'image.jpg',
        ),
        'patientId': widget.patientId,
      });

      final response = await ApiClient.instance.postAi(
        widget.apiEndpoint,
        data: formData,
      );

      if (!mounted) return;
      final body = response.data as Map<String, dynamic>;
      setState(() {
        _result = body;
        _analyzing = false;
      });

      // Heatmap base64'ü ve orijinal görseli kalıcı dosyalara kaydet
      final dir = await getApplicationDocumentsDirectory();
      final ts = DateTime.now().millisecondsSinceEpoch;

      // Orijinal görseli kalıcı konuma kopyala
      String? savedOriginalPath;
      try {
        final destFile = File(
          '${dir.path}/orig_${widget.label.toLowerCase()}_$ts.jpg',
        );
        await File(image.path).copy(destFile.path);
        savedOriginalPath = destFile.path;
      } catch (_) {
        savedOriginalPath = image.path; // geçici path'i fallback olarak kullan
      }

      // Heatmap base64'ü dosyaya kaydet
      String? savedHeatmapPath;
      final heatmapRaw = body['heatmapPlus'] as String?;
      if (heatmapRaw != null && heatmapRaw.isNotEmpty) {
        try {
          final b64 = heatmapRaw.contains(',')
              ? heatmapRaw.split(',').last
              : heatmapRaw;
          final bytes = base64Decode(b64);
          final heatFile = File(
            '${dir.path}/heat_${widget.label.toLowerCase()}_$ts.png',
          );
          await heatFile.writeAsBytes(bytes);
          savedHeatmapPath = heatFile.path;
        } catch (_) {}
      }

      // Analizi kaydet
      final pytorch = body['pytorch'] as Map<String, dynamic>?;
      final savedAnalysis = AnalysisApiModel(
        id: UuidGenerator.generateOfflineId(),
        patientId: widget.patientId,
        aiResult: _aiLabel ?? 'unknown',
        confidence: _confidence,
        heatmapUrl: savedHeatmapPath ?? (body['heatmapUrl'] as String?),
        originalImage: savedOriginalPath,
        createdAt: DateTime.now(),
        isSynced: false,
        reportKind: widget.label.toLowerCase(),
        drGradeInt: (body['drGrade'] as num?)?.toInt(),
        drFeedback: pytorch?['label'] as String?,
      );
      await AnalysisService.instance.add(savedAnalysis);
      widget.onAnalysisSaved();
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map
          ? (e.response!.data as Map)['error'] ?? 'Sunucu hatası'
          : 'Bağlantı hatası';
      setState(() {
        _analyzing = false;
        _errorMsg = msg.toString();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _analyzing = false;
        _errorMsg = 'Hata: $e';
      });
    }
  }

  Future<void> _pickAndAnalyze() async {
    try {
      final image = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );
      if (image == null || !mounted) return;
      setState(() {
        _pickedImage = image;
        _result = null;
        _errorMsg = null;
      });
      await _sendToApi(image);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _analyzing = false;
        _errorMsg = 'Görsel seçilemedi: $e';
      });
    }
  }

  Future<void> _retryAnalysis() async {
    if (_pickedImage == null) return;
    await _sendToApi(_pickedImage!);
  }

  void _reset() {
    setState(() {
      _pickedImage = null;
      _result = null;
      _errorMsg = null;
    });
    widget.onClearTransfer();
  }

  void _transfer() {
    if (_aiLabel == null) return;
    final pct = (_confidence * 100).toStringAsFixed(0);
    widget.onTransfer(
      '${widget.label} AI: $_aiLabel tespit edildi. Güven: %$pct.',
    );
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${widget.label} sonucu rapora aktarıldı.'),
        backgroundColor: const Color(0xFF006645),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: widget.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: widget.iconBg,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(widget.icon, size: 18, color: widget.iconColor),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.label,
                      style: GoogleFonts.manrope(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF14243D),
                      ),
                    ),
                    Text(
                      widget.subtitle,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: const Color(0xFF5D6B82),
                      ),
                    ),
                  ],
                ),
              ),
              if (_pickedImage != null)
                GestureDetector(
                  onTap: _reset,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFEBEE),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Icon(
                      Icons.close,
                      size: 16,
                      color: Color(0xFFC62828),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          // Yükleme butonu ya da loading
          if (_pickedImage == null) ...[
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.upload_rounded, size: 15),
                label: Text(
                  'Görsel Yükle',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _primary,
                  side: const BorderSide(color: _primary),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                ),
                onPressed: _pickAndAnalyze,
              ),
            ),
          ] else ...[
            // Seçilen görsel
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.file(
                File(_pickedImage!.path),
                width: double.infinity,
                height: 180,
                fit: BoxFit.cover,
              ),
            ),

            // Yükleniyor animasyonu
            if (_analyzing) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: _primary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'AI analiz ediliyor...',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: _primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],

            // Hata mesajı
            if (_errorMsg != null) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFEBEE),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFEF9A9A)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.error_outline,
                      size: 16,
                      color: Color(0xFFC62828),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMsg!,
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: const Color(0xFFC62828),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                icon: const Icon(Icons.refresh, size: 14),
                label: Text(
                  'Tekrar Dene',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: _primary,
                  side: const BorderSide(color: _primary),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                onPressed: _retryAnalysis,
              ),
            ],

            // Sonuç
            if (_result != null && !_analyzing) ...[
              const SizedBox(height: 10),

              // Heatmap
              if (_heatmapBase64 != null && _heatmapBase64!.isNotEmpty) ...[
                Text(
                  'Isı Haritası (Heatmap)',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF64748B),
                  ),
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.memory(
                    Uri.parse(_heatmapBase64!).data!.contentAsBytes(),
                    width: double.infinity,
                    height: 180,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
                const SizedBox(height: 10),
              ],

              // Sonuç kutusu
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE3F2FD),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFF90CAF9)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.auto_awesome,
                          size: 15,
                          color: Color(0xFF1565C0),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'AI Sonucu',
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF1565C0),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _aiLabel ?? '-',
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0D47A1),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Güven: %${(_confidence * 100).toStringAsFixed(1)}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: const Color(0xFF1565C0),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              // Forma aktar / temizle
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      icon: const Icon(
                        Icons.arrow_circle_right_outlined,
                        size: 15,
                      ),
                      label: Text(
                        widget.transferText.isEmpty
                            ? 'Forma Aktar'
                            : 'Aktarıldı ✓',
                        style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: widget.transferText.isEmpty
                            ? const Color(0xFF0A8FB6)
                            : const Color(0xFF2E7D32),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                      onPressed: widget.transferText.isEmpty ? _transfer : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.refresh, size: 14),
                    label: Text(
                      'Yeni',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF64748B),
                      side: const BorderSide(color: Color(0xFFCFD8DC)),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 12,
                      ),
                    ),
                    onPressed: _reset,
                  ),
                ],
              ),
            ],
          ],

          // Aktarılmış metin göstergesi
          if (widget.transferText.isNotEmpty && _result == null) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFA5D6A7)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.check_circle_rounded,
                    size: 16,
                    color: Color(0xFF2E7D32),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.transferText,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: const Color(0xFF1B5E20),
                        height: 1.5,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: widget.onClearTransfer,
                    child: const Icon(
                      Icons.close,
                      size: 16,
                      color: Color(0xFF4CAF50),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

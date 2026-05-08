import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../data/models/patient_api_model.dart';

class PatientDetailScreen extends StatefulWidget {
  const PatientDetailScreen({super.key, required this.patient});

  final PatientApiModel patient;

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen>
    with TickerProviderStateMixin {
  late final TabController _tabController;
  bool _aiExpanded = true;

  final _reportTitleController = TextEditingController(
    text: 'Goz Muayene Raporu',
  );
  final _doctorController = TextEditingController(text: 'Dr. Ece');
  final _anamnesisController = TextEditingController(
    text: 'Hastanin sikayeti, semptom suresi, onceki tedavi oykusu',
  );
  final _examController = TextEditingController(
    text: 'Gorme keskinligi, biyomikroskopi, fundus muayenesi bulgulari',
  );
  final _labController = TextEditingController(
    text: 'HbA1c, glukoz, lipid profili gibi laboratuvar bilgileri',
  );
  final _diagnosisController = TextEditingController(
    text: 'Klinik degerlendirme ve nihai tani',
  );
  final _treatmentController = TextEditingController(
    text: 'Tedavi plani, ilac onerileri ve kontrol onerisi',
  );
  final _doctorNotesController = TextEditingController(
    text: 'Ek klinik notlar, ozel uyarilar veya takip plani',
  );

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
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
                        _infoBanner(),
                        const SizedBox(height: 12),
                        _label('Rapor Basligi'),
                        _input(_reportTitleController),
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
                        _input(_doctorController),
                        const SizedBox(height: 10),
                        _label('Klinik Oyku (Anamnez)'),
                        _input(_anamnesisController, maxLines: 3),
                        const SizedBox(height: 10),
                        _label('Muayene Bulgulari'),
                        _input(_examController, maxLines: 3),
                        const SizedBox(height: 10),
                        _label('Laboratuvar Sonuclari'),
                        _input(_labController, maxLines: 3),
                        const SizedBox(height: 10),
                        _label('Teshis / Klinik Degerlendirme'),
                        _input(_diagnosisController, maxLines: 3),
                        const SizedBox(height: 10),
                        _label('Tedavi ve Oneriler'),
                        _input(_treatmentController, maxLines: 3),
                        const SizedBox(height: 10),
                        _aiSection(card, border),
                        const SizedBox(height: 10),
                        _label('Doktor Notlari'),
                        _input(_doctorNotesController, maxLines: 3),
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
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Rapor kaydedildi.'),
                                ),
                              );
                            },
                            child: Text(
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
                children: [
                  _panel(card, border, child: _aiSection(card, border)),
                ],
              ),
            ),
          ),
          // Tab 3: Raporlar (klinik rapor geçmişi)
          SafeArea(
            child: Center(
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
                  ],
                ),
              ),
            ),
          ),
          // Tab 4: Radyolojik Raporlar (AI analiz geçmişi)
          SafeArea(
            child: Center(
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
                  ],
                ),
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

  Widget _aiSection(Color card, Color border) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF7FAFF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 12),
          childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          title: Text(
            'AI Analiz (Opsiyonel)',
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w700,
              color: const Color(0xFF223552),
            ),
          ),
          initiallyExpanded: _aiExpanded,
          onExpansionChanged: (value) => setState(() => _aiExpanded = value),
          children: [
            _mediaPlaceholder('AI Gorsel Analiz'),
            const SizedBox(height: 10),
            _summaryCard(),
            const SizedBox(height: 10),
            _clinicalDetailCard(),
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFEAFBF3),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFA9E7C5)),
              ),
              child: Text(
                'Analiz hazir. Sonucu forma aktarmak icin asagidaki butonu kullanin.',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF1D7A52),
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(child: _outlinedButton('EVET')),
                const SizedBox(width: 8),
                Expanded(child: _outlinedButton('HAYIR')),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(child: _disabledButton('Sonucu Forma Aktar')),
                const SizedBox(width: 8),
                Expanded(child: _outlinedButton('Temizle')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _mediaPlaceholder(String title) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: Colors.white,
        border: Border.all(color: const Color(0xFFD7DFEA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: GoogleFonts.manrope(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF12233D),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Retina fundus gorselini analiz edin. Sonuclar otomatik olarak rapora eklenir.',
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFF4D5D77),
            ),
          ),
          const SizedBox(height: 10),
          Container(
            height: 160,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: const LinearGradient(
                colors: [Color(0xFF000B2A), Color(0xFF071D4F)],
              ),
            ),
            alignment: Alignment.center,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                color: const Color(0xFF7A4A27),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFF3D173), width: 2),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.visibility, color: Colors.white70),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E5DA7),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'AI Sonuc Ozeti',
            style: GoogleFonts.inter(
              fontSize: 12,
              color: const Color(0xFFAED2FF),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Evre 1 (Hafif - Mild NPDR)',
            style: GoogleFonts.manrope(
              fontSize: 26,
              height: 1.1,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          _chip('Guven: %60.0'),
          const SizedBox(height: 6),
          _chip('Ek riskler: DME suphe (%50)'),
        ],
      ),
    );
  }

  Widget _clinicalDetailCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD7DFEA)),
      ),
      child: Text(
        'Klinik detay\n\nModel etiketi: Mild NPDR\nDME suphe: evet\n\nKlinik gerekce:\nFundusta yaygin mikroanevrizma ve sert eksuda gorulmektedir.\n\nOnerilen aksiyonlar:\n- Goz hastaliklari uzmani gorusu\n- 3-6 ay icinde kontrol',
        style: GoogleFonts.inter(
          fontSize: 12,
          color: const Color(0xFF33445E),
          height: 1.5,
        ),
      ),
    );
  }

  Widget _chip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF2D71C0),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        text,
        style: GoogleFonts.inter(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: 12,
        ),
      ),
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

  Widget _infoBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5FA),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFD7DFEA)),
      ),
      child: Text(
        'AI analiz zorunlu degildir. Isterseniz asagidaki AI bolumunden analiz yapabilirsiniz.',
        style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF4D5D77)),
      ),
    );
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

  Widget _input(TextEditingController controller, {int maxLines = 1}) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
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

  Widget _outlinedButton(String text) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        side: const BorderSide(color: Color(0xFFBDC9D8)),
        foregroundColor: const Color(0xFF21344F),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(vertical: 11),
      ),
      onPressed: () {},
      child: Text(text, style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
    );
  }

  Widget _disabledButton(String text) {
    return FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: const Color(0xFFE5EBF2),
        foregroundColor: const Color(0xFF70819A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(vertical: 11),
      ),
      onPressed: null,
      child: Text(text, style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
    );
  }
}

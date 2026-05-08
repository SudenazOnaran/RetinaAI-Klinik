import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../theme/app_theme.dart';
import '../widgets/index.dart';
import '../data/models/analysis_api_model.dart';

class ResultsScreen extends StatelessWidget {
  final AnalysisApiModel analysis;

  const ResultsScreen({Key? key, required this.analysis}) : super(key: key);

  // DR grade -> renk, etiket, risk seviyesi
  static _RiskInfo _riskFromAnalysis(AnalysisApiModel a) {
    final grade = a.drGradeInt;
    if (grade == null) {
      // aiResult metin tabanlı fallback
      final lower = a.aiResult.toLowerCase();
      if (lower.contains('no_dr') || lower.contains('grade_0') || lower == 'no dr') {
        return _RiskInfo('YOK', ClinicalRiskLevel.low, const Color(0xFF2E7D32), const Color(0xFFE8F5E9));
      }
      if (lower.contains('mild') || lower.contains('grade_1')) {
        return _RiskInfo('HAFİF', ClinicalRiskLevel.low, const Color(0xFF388E3C), const Color(0xFFF1F8E9));
      }
      if (lower.contains('moderate') || lower.contains('grade_2')) {
        return _RiskInfo('ORTA', ClinicalRiskLevel.medium, const Color(0xFFF57F17), const Color(0xFFFFFDE7));
      }
      return _RiskInfo('YÜKSEK', ClinicalRiskLevel.high, const Color(0xFFC62828), const Color(0xFFFFEBEE));
    }
    switch (grade) {
      case 0: return _RiskInfo('YOK', ClinicalRiskLevel.low, const Color(0xFF2E7D32), const Color(0xFFE8F5E9));
      case 1: return _RiskInfo('HAFİF', ClinicalRiskLevel.low, const Color(0xFF388E3C), const Color(0xFFF1F8E9));
      case 2: return _RiskInfo('ORTA', ClinicalRiskLevel.medium, const Color(0xFFF57F17), const Color(0xFFFFFDE7));
      case 3: return _RiskInfo('YÜKSEK', ClinicalRiskLevel.high, const Color(0xFFD84315), const Color(0xFFFBE9E7));
      default: return _RiskInfo('ÇOK YÜKSEK', ClinicalRiskLevel.high, const Color(0xFFC62828), const Color(0xFFFFEBEE));
    }
  }

  static String _drLabel(AnalysisApiModel a) {
    final grade = a.drGradeInt;
    switch (grade) {
      case 0: return 'Diyabetik Retinopati Yok';
      case 1: return 'Hafif Diyabetik Retinopati';
      case 2: return 'Orta Diyabetik Retinopati';
      case 3: return 'Şiddetli Diyabetik Retinopati';
      case 4: return 'Proliferatif Diyabetik Retinopati';
      default: return a.aiResult;
    }
  }

  @override
  Widget build(BuildContext context) {
    final risk = _riskFromAnalysis(analysis);
    final confidencePct = (analysis.confidence * 100).clamp(0.0, 100.0);
    final highRisk = risk.level == ClinicalRiskLevel.high;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/home'),
        ),
        title: Text(
          'Analiz Sonucu',
          style: GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.w600),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Risk kartı
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: risk.bgColor,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Risk Seviyesi Değerlendirmesi',
                        style: GoogleFonts.manrope(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: AppColors.onBackground,
                        ),
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Container(
                            width: 100,
                            height: 100,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(50),
                              border: Border.all(
                                color: risk.color.withOpacity(0.4),
                                width: 2,
                              ),
                            ),
                            child: Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    risk.label,
                                    style: GoogleFonts.manrope(
                                      fontSize: risk.label.length > 4 ? 13 : 16,
                                      fontWeight: FontWeight.w700,
                                      color: risk.color,
                                    ),
                                    textAlign: TextAlign.center,
                                  ),
                                  Text(
                                    'RİSK',
                                    style: GoogleFonts.inter(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: risk.color,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(width: 24),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Güven Skoru',
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.secondary,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '${confidencePct.toStringAsFixed(1)}%',
                                  style: GoogleFonts.manrope(
                                    fontSize: 32,
                                    fontWeight: FontWeight.w700,
                                    color: risk.color,
                                  ),
                                ),
                                const SizedBox(height: 12),
                                LinearProgressIndicator(
                                  minHeight: 8,
                                  value: analysis.confidence.clamp(0.0, 1.0),
                                  backgroundColor: Colors.white,
                                  valueColor: AlwaysStoppedAnimation<Color>(risk.color),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Teşhis etiketi
                ClinicalChip(
                  label: _drLabel(analysis),
                  riskLevel: risk.level,
                ),
                const SizedBox(height: 24),

                // Heatmap / görüntü
                if (analysis.heatmapUrl != null) ...[
                  Text(
                    'AI Isı Haritası',
                    style: GoogleFonts.manrope(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onBackground,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: CachedNetworkImage(
                      imageUrl: analysis.heatmapUrl!,
                      width: double.infinity,
                      height: 200,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(
                        height: 200,
                        color: AppColors.surfaceContainerLow,
                        child: const Center(child: CircularProgressIndicator()),
                      ),
                      errorWidget: (_, __, ___) => _heatmapPlaceholder(),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Yüksek risk uyarısı
                if (highRisk)
                  Container(
                    padding: const EdgeInsets.all(16),
                    margin: const EdgeInsets.only(bottom: 24),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF3E0),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: const Color(0xFFE65100).withOpacity(0.4),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.warning_amber_rounded,
                            color: Color(0xFFE65100), size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Yüksek risk tespit edildi. Lütfen en kısa sürede göz hastalıkları uzmanına başvurun.',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: const Color(0xFFBF360C),
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                // Sağlık uyarısı banner
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.outline),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info_outline,
                          size: 18, color: AppColors.secondary),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Bu analiz yalnızca destekleyici bir araçtır ve kesin tanı yerine geçmez. '
                          'Klinik karar için mutlaka yetkili bir hekim görüşü alınız.',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: AppColors.secondary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Doktor notu varsa
                if (analysis.doctorNote != null &&
                    analysis.doctorNote!.isNotEmpty) ...[
                  Text(
                    'Doktor Notu',
                    style: GoogleFonts.manrope(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onBackground,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    analysis.doctorNote!,
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.onBackground,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 24),
                ],

                // Ana sayfaya dön
                SizedBox(
                  width: double.infinity,
                  child: GradientButton(
                    label: 'Ana Sayfaya Dön',
                    onPressed: () => context.go('/home'),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _heatmapPlaceholder() {
    return Container(
      height: 200,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.blue.withOpacity(0.3),
            Colors.cyan.withOpacity(0.2),
            Colors.yellow.withOpacity(0.2),
            Colors.red.withOpacity(0.3),
          ],
        ),
      ),
      child: Center(
        child: Text(
          'Isı haritası mevcut değil',
          style: GoogleFonts.inter(fontSize: 13, color: AppColors.secondary),
        ),
      ),
    );
  }
}

class _RiskInfo {
  final String label;
  final ClinicalRiskLevel level;
  final Color color;
  final Color bgColor;
  const _RiskInfo(this.label, this.level, this.color, this.bgColor);
}

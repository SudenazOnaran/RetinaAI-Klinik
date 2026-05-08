import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import 'section_container.dart';

/// A reusable AI analysis result card.
///
/// Displays the AI summary, heatmap preview, and ODIR risk predictions.
/// No borders — uses surface layering and soft shadows.
class AiAnalysisCard extends StatelessWidget {
  final String summary;
  final String? highlightedTerm;
  final String? heatmapImageUrl;
  final List<RiskPrediction> predictions;
  final VoidCallback? onConfirm;
  final VoidCallback? onReject;

  const AiAnalysisCard({
    Key? key,
    required this.summary,
    this.highlightedTerm,
    this.heatmapImageUrl,
    this.predictions = const [],
    this.onConfirm,
    this.onReject,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SectionContainer(
      color: AppColors.surfaceContainerLow,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.psychology_alt_rounded,
                  color: Colors.white,
                  size: 16,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Yapay Zeka Analizi',
                  style: GoogleFonts.manrope(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.onSurface,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF008259).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  'AI AKTİF',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF006645),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Summary
          _buildSummary(),
          const SizedBox(height: 16),
          // Heatmap + Predictions row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _HeatmapPreview(imageUrl: heatmapImageUrl)),
              const SizedBox(width: 12),
              Expanded(child: _PredictionsList(predictions: predictions)),
            ],
          ),
          const SizedBox(height: 16),
          // Confirm / Reject
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.06),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Text(
                  'AI BULGULARINI DOĞRULUYOR MUSUNUZ?',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _ActionChip(
                        label: 'EVET',
                        icon: Icons.check_circle,
                        color: const Color(0xFF006645),
                        onTap: onConfirm,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _ActionChip(
                        label: 'HAYIR',
                        icon: Icons.cancel,
                        color: const Color(0xFFBA1A1A),
                        onTap: onReject,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummary() {
    if (highlightedTerm == null || highlightedTerm!.isEmpty) {
      return Text(
        summary,
        style: GoogleFonts.inter(
          fontSize: 14,
          height: 1.5,
          color: AppColors.onSurface,
        ),
      );
    }

    final parts = summary.split(highlightedTerm!);
    return RichText(
      text: TextSpan(
        style: GoogleFonts.inter(
          fontSize: 14,
          height: 1.5,
          color: AppColors.onSurface,
        ),
        children: [
          if (parts.isNotEmpty) TextSpan(text: parts.first),
          TextSpan(
            text: highlightedTerm,
            style: const TextStyle(
              color: Color(0xFFBA1A1A),
              fontWeight: FontWeight.w700,
            ),
          ),
          if (parts.length > 1) TextSpan(text: parts.last),
        ],
      ),
    );
  }
}

class _HeatmapPreview extends StatelessWidget {
  final String? imageUrl;

  const _HeatmapPreview({this.imageUrl});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'HEATMAP ANALİZİ',
          style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: AppColors.outline,
            letterSpacing: 0.9,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          height: 120,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF3F444A), Color(0xFF324D60)],
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: imageUrl != null
              ? Opacity(
                  opacity: 0.65,
                  child: Image.network(
                    imageUrl!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const Center(
                      child: Icon(Icons.image, color: Colors.white54, size: 32),
                    ),
                  ),
                )
              : const Center(
                  child: Icon(Icons.image, color: Colors.white54, size: 32),
                ),
        ),
      ],
    );
  }
}

class _PredictionsList extends StatelessWidget {
  final List<RiskPrediction> predictions;

  const _PredictionsList({required this.predictions});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ODIR RİSK TAHMİNLERİ',
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.outline,
              letterSpacing: 0.9,
            ),
          ),
          const SizedBox(height: 10),
          ...predictions.map(
            (p) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RiskRow(
                label: p.label,
                value: p.value,
                progress: p.progress,
                color: p.color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RiskRow extends StatelessWidget {
  final String label;
  final String value;
  final double progress;
  final Color color;

  const _RiskRow({
    required this.label,
    required this.value,
    required this.progress,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.onSurface,
                ),
              ),
            ),
            Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            minHeight: 4,
            value: progress,
            backgroundColor: AppColors.surfaceContainerLow,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }
}

class _ActionChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _ActionChip({
    required this.label,
    required this.icon,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 42,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              blurRadius: 12,
              color: color.withOpacity(0.08),
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 6),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class RiskPrediction {
  final String label;
  final String value;
  final double progress;
  final Color color;

  const RiskPrediction({
    required this.label,
    required this.value,
    required this.progress,
    required this.color,
  });
}

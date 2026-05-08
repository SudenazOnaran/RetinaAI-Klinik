import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class ClinicalChip extends StatelessWidget {
  final String label;
  final ClinicalRiskLevel riskLevel;

  const ClinicalChip({Key? key, required this.label, required this.riskLevel})
    : super(key: key);

  Color get _backgroundColor {
    switch (riskLevel) {
      case ClinicalRiskLevel.high:
        return const Color(0xFFFFEBEE);
      case ClinicalRiskLevel.medium:
        return const Color(0xFFFFF3E0);
      case ClinicalRiskLevel.low:
        return const Color(0xFFE8F5E9);
    }
  }

  Color get _textColor {
    switch (riskLevel) {
      case ClinicalRiskLevel.high:
        return const Color(0xFFC62828);
      case ClinicalRiskLevel.medium:
        return const Color(0xFFE65100);
      case ClinicalRiskLevel.low:
        return const Color(0xFF2E7D32);
    }
  }

  Icon get _icon {
    switch (riskLevel) {
      case ClinicalRiskLevel.high:
        return const Icon(Icons.warning_rounded);
      case ClinicalRiskLevel.medium:
        return const Icon(Icons.info_rounded);
      case ClinicalRiskLevel.low:
        return const Icon(Icons.check_circle_rounded);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: _backgroundColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_icon.icon, color: _textColor, size: 20),
          const SizedBox(width: 8),
          Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: _textColor,
            ),
          ),
        ],
      ),
    );
  }
}

enum ClinicalRiskLevel { high, medium, low }

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Risk levels supported by the badge.
enum RiskLevel { low, medium, high, critical }

/// A reusable risk badge used across patient cards and analysis screens.
///
/// Displays a colored pill with an icon and label. No borders — uses
/// solid background colors to convey severity.
class RiskBadge extends StatelessWidget {
  final String label;
  final RiskLevel level;

  const RiskBadge({Key? key, required this.label, required this.level})
    : super(key: key);

  Color get _backgroundColor {
    switch (level) {
      case RiskLevel.critical:
        return const Color(0xFFFFEBEE);
      case RiskLevel.high:
        return const Color(0xFFFFDAD6);
      case RiskLevel.medium:
        return const Color(0xFFFFF3E0);
      case RiskLevel.low:
        return const Color(0xFFE8F5E9);
    }
  }

  Color get _textColor {
    switch (level) {
      case RiskLevel.critical:
        return const Color(0xFF93000A);
      case RiskLevel.high:
        return const Color(0xFFBA1A1A);
      case RiskLevel.medium:
        return const Color(0xFFE65100);
      case RiskLevel.low:
        return const Color(0xFF2E7D32);
    }
  }

  IconData get _icon {
    switch (level) {
      case RiskLevel.critical:
        return Icons.error_rounded;
      case RiskLevel.high:
        return Icons.warning_rounded;
      case RiskLevel.medium:
        return Icons.info_rounded;
      case RiskLevel.low:
        return Icons.check_circle_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: _backgroundColor,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_icon, color: _textColor, size: 18),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: _textColor,
            ),
          ),
        ],
      ),
    );
  }
}

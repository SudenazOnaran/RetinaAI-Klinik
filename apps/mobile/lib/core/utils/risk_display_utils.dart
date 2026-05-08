import 'package:flutter/material.dart';
import 'package:retina_ai_app/widgets/risk_badge.dart';

/// Converts spec DR-grade risk strings (e.g. "Evre 3 (Şiddetli...)") and
/// legacy strings ('high', 'critical') to a [RiskLevel].
/// Spec §4.3 risk badge colors: Yok/Evre0=gray/green, Evre1=blue, Evre2=yellow, Evre3=orange, Evre4=red
RiskLevel toRiskLevel(String risk) {
  final r = risk.toLowerCase();
  // Legacy
  if (r == 'critical') return RiskLevel.critical;
  if (r == 'high') return RiskLevel.high;
  if (r == 'medium') return RiskLevel.medium;
  if (r == 'low') return RiskLevel.low;
  // Spec DR grade strings
  if (r.contains('evre 4') ||
      r.contains('stage 4') ||
      r.contains('proliferat')) {
    return RiskLevel.critical;
  }
  if (r.contains('evre 3') || r.contains('stage 3') || r.contains('severe')) {
    return RiskLevel.high;
  }
  if (r.contains('evre 2') || r.contains('stage 2') || r.contains('moderate')) {
    return RiskLevel.medium;
  }
  if (r.contains('evre 1') || r.contains('stage 1') || r.contains('mild')) {
    return RiskLevel.low;
  }
  // "Yok" / "Evre 0" / no risk
  return RiskLevel.low;
}

/// Returns true when patient qualifies as high-risk per spec §3.2.
bool isHighRisk(String risk) {
  final r = risk.toLowerCase();
  return r.contains('__dtg__:urgent') ||
      r.contains('evre 3') ||
      r.contains('stage 3') ||
      r.contains('evre 4') ||
      r.contains('stage 4') ||
      r.contains('severe npdr') ||
      r.contains('proliferat') ||
      r == 'high' ||
      r == 'critical';
}

Color urgencyBg(String risk) {
  switch (toRiskLevel(risk)) {
    case RiskLevel.critical:
      return const Color(0xFFBA1A1A);
    case RiskLevel.high:
      return const Color(0xFFE64800);
    case RiskLevel.medium:
      return const Color(0xFFFFB300);
    case RiskLevel.low:
      return const Color(0xFFE0E3E5);
  }
}

Color urgencyText(String risk) {
  return toRiskLevel(risk) == RiskLevel.low
      ? const Color(0xFF404850)
      : Colors.white;
}

String urgencyLabel(String risk) {
  switch (toRiskLevel(risk)) {
    case RiskLevel.critical:
    case RiskLevel.high:
      return 'ACİL';
    case RiskLevel.medium:
      return 'TAKİP';
    case RiskLevel.low:
      return 'RUTİN';
  }
}

String riskLabel(String risk) {
  switch (toRiskLevel(risk)) {
    case RiskLevel.critical:
      return 'ÇOK YÜKSEK RİSK';
    case RiskLevel.high:
      return 'YÜKSEK RİSK';
    case RiskLevel.medium:
      return 'ORTA RİSK';
    case RiskLevel.low:
      return 'SAĞLIKLI';
  }
}

Color riskDot(String risk) {
  switch (toRiskLevel(risk)) {
    case RiskLevel.critical:
    case RiskLevel.high:
      return const Color(0xFFBA1A1A);
    case RiskLevel.medium:
      return const Color(0xFFE6A400);
    case RiskLevel.low:
      return const Color(0xFF008259);
  }
}

String riskDoctorText(String risk) {
  switch (toRiskLevel(risk)) {
    case RiskLevel.critical:
      return 'Dr. Risk: Kritik Seviye';
    case RiskLevel.high:
      return 'Dr. Risk: Yüksek Seviye';
    case RiskLevel.medium:
      return 'Dr. Risk: İzlem Altında';
    case RiskLevel.low:
      return 'Dr. Risk: Stabil';
  }
}

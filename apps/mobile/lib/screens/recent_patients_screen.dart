import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:retina_ai_app/core/providers/patient_api_provider.dart';
import 'package:retina_ai_app/core/utils/risk_display_utils.dart';
import 'package:retina_ai_app/data/models/patient_api_model.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';
import 'package:retina_ai_app/widgets/patient_card.dart';

class RecentPatientsScreen extends ConsumerWidget {
  const RecentPatientsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final patientState = ref.watch(patientApiProvider);
    final recentPatients = patientState.patients.take(4).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FB),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  const Icon(
                    Icons.history_rounded,
                    color: Color(0xFF005D90),
                    size: 22,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Son Kayıtlar',
                    style: GoogleFonts.manrope(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF111827),
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => context.go('/patients'),
                    child: Text(
                      'Tüm Liste',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF005D90),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                children: [
                  Text(
                    'Yeni eklenen veya son güncellenen hastaları hızlıca inceleyin.',
                    style: GoogleFonts.inter(
                      fontSize: 13,
                      color: const Color(0xFF4B5563),
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (recentPatients.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 24),
                      child: Text(
                        'Henüz kayıtlı hasta yok.',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: const Color(0xFF6B7280),
                        ),
                      ),
                    ),
                  ...recentPatients.map(
                    (patient) => Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: _RecentPatientCard(patient: patient),
                    ),
                  ),
                ],
              ),
            ),
            const ClinicBottomNav(selectedTab: ClinicBottomTab.patients),
          ],
        ),
      ),
    );
  }
}

class _RecentPatientCard extends StatelessWidget {
  const _RecentPatientCard({required this.patient});

  final PatientApiModel patient;

  @override
  Widget build(BuildContext context) {
    return PatientCard(
      name: patient.fullName,
      tc: patient.tcNo,
      urgency: urgencyLabel(patient.risk),
      urgencyBackground: urgencyBg(patient.risk),
      urgencyText: urgencyText(patient.risk),
      riskLabel: riskLabel(patient.risk),
      riskLevel: toRiskLevel(patient.risk),
      lastAnalysisDate: patient.createdAt.toLocal().toString().split(' ').first,
      confidenceScore: '',
      doctorRiskText: riskDoctorText(patient.risk),
      doctorRiskDot: riskDot(patient.risk),
      onTap: () => context.push('/patients/detail', extra: patient),
    );
  }
}

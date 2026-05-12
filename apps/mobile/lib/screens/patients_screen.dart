import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:retina_ai_app/core/providers/patient_api_provider.dart';
import 'package:retina_ai_app/widgets/clinic_app_header.dart';
import 'package:retina_ai_app/core/utils/risk_display_utils.dart';
import 'package:retina_ai_app/widgets/risk_badge.dart';
import 'package:retina_ai_app/data/models/patient_api_model.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';
import 'package:retina_ai_app/widgets/patient_card.dart';

enum PatientListFilter { all, highRisk, mediumRisk, recent }

class PatientsScreen extends ConsumerStatefulWidget {
  const PatientsScreen({super.key, this.initialFilter});

  final String? initialFilter;

  @override
  ConsumerState<PatientsScreen> createState() => _PatientsScreenState();
}

class _PatientsScreenState extends ConsumerState<PatientsScreen> {
  late PatientListFilter _selectedFilter;

  @override
  void initState() {
    super.initState();
    _selectedFilter = _parseFilter(widget.initialFilter);
    // Trigger API load
    Future.microtask(
      () => ref.read(patientApiProvider.notifier).loadPatients(),
    );
  }

  PatientListFilter _parseFilter(String? filter) {
    switch (filter) {
      case 'high-risk':
        return PatientListFilter.highRisk;
      case 'medium-risk':
        return PatientListFilter.mediumRisk;
      case 'recent':
        return PatientListFilter.recent;
      default:
        return PatientListFilter.all;
    }
  }

  List<PatientApiModel> _filteredPatients(List<PatientApiModel> all) {
    switch (_selectedFilter) {
      case PatientListFilter.highRisk:
        return all.where((p) => isHighRisk(p.risk)).toList();
      case PatientListFilter.mediumRisk:
        return all
            .where(
              (p) =>
                  toRiskLevel(p.risk) == RiskLevel.medium &&
                  !isHighRisk(p.risk),
            )
            .toList();
      case PatientListFilter.recent:
        return all.take(4).toList();
      case PatientListFilter.all:
        return all;
    }
  }

  @override
  Widget build(BuildContext context) {
    final patientState = ref.watch(patientApiProvider);
    final visible = _filteredPatients(patientState.patients);
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 390).clamp(0.82, 1.0);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FB),
      body: SafeArea(
        child: Column(
          children: [
            const ClinicAppHeader(),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
            Expanded(
              child: patientState.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : patientState.error != null
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'Hastalar yüklenemedi.',
                            style: GoogleFonts.inter(color: Colors.red),
                          ),
                          const SizedBox(height: 8),
                          TextButton(
                            onPressed: () => ref
                                .read(patientApiProvider.notifier)
                                .loadPatients(),
                            child: const Text('Tekrar Dene'),
                          ),
                        ],
                      ),
                    )
                  : ListView(
                      padding: EdgeInsets.fromLTRB(
                        14 * scale,
                        14 * scale,
                        14 * scale,
                        144 * scale,
                      ),
                      children: [
                        ClinicPageTitleCard(
                          title: 'Hasta Kayıtları',
                          subtitle:
                              'Hasta portföyünüz ve analiz yükünüzün güncel özetini buradan takip edebilirsiniz.',
                        ),
                        SizedBox(height: 14 * scale),
                        _SearchBox(scale: scale),
                        SizedBox(height: 14 * scale),
                        Row(
                          children: [
                            Expanded(
                              child: _FilterChip(
                                label: 'Tümü',
                                active:
                                    _selectedFilter == PatientListFilter.all,
                                scale: scale,
                                onTap: () => setState(
                                  () => _selectedFilter = PatientListFilter.all,
                                ),
                              ),
                            ),
                            SizedBox(width: 8 * scale),
                            Expanded(
                              child: _FilterChip(
                                label: 'Yüksek Risk',
                                active:
                                    _selectedFilter ==
                                    PatientListFilter.highRisk,
                                scale: scale,
                                onTap: () => setState(
                                  () => _selectedFilter =
                                      PatientListFilter.highRisk,
                                ),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 12 * scale),
                        Row(
                          children: [
                            Expanded(
                              child: _FilterChip(
                                label: 'Orta Risk',
                                active:
                                    _selectedFilter ==
                                    PatientListFilter.mediumRisk,
                                scale: scale,
                                onTap: () => setState(
                                  () => _selectedFilter =
                                      PatientListFilter.mediumRisk,
                                ),
                              ),
                            ),
                            SizedBox(width: 8 * scale),
                            Expanded(
                              child: _FilterChip(
                                label: 'Son Kaydedilen',
                                active:
                                    _selectedFilter == PatientListFilter.recent,
                                scale: scale,
                                onTap: () => setState(
                                  () => _selectedFilter =
                                      PatientListFilter.recent,
                                ),
                              ),
                            ),
                          ],
                        ),
                        SizedBox(height: 18 * scale),
                        if (visible.isEmpty)
                          Padding(
                            padding: EdgeInsets.symmetric(vertical: 24 * scale),
                            child: Text(
                              'Bu filtrede hasta bulunamadi.',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(
                                fontSize: 13 * scale,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF5C6470),
                              ),
                            ),
                          ),
                        ...visible.map(
                          (patient) => Padding(
                            padding: EdgeInsets.only(bottom: 16 * scale),
                            child: PatientCard(
                              name: patient.fullName,
                              tc: patient.tcNo,
                              urgency: urgencyLabel(patient.risk),
                              urgencyBackground: urgencyBg(patient.risk),
                              urgencyText: urgencyText(patient.risk),
                              riskLabel: riskLabel(patient.risk),
                              riskLevel: toRiskLevel(patient.risk),
                              lastAnalysisDate: patient.createdAt
                                  .toLocal()
                                  .toString()
                                  .split(' ')
                                  .first,
                              confidenceScore: '',
                              doctorRiskText: riskDoctorText(patient.risk),
                              doctorRiskDot: riskDot(patient.risk),
                              onTap: () => context.push(
                                '/patients/detail',
                                extra: patient,
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
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      floatingActionButton: Padding(
        padding: EdgeInsets.only(bottom: 80 * scale, right: 4 * scale),
        child: SizedBox(
          width: 56 * scale,
          height: 56 * scale,
          child: FloatingActionButton(
            elevation: 10,
            backgroundColor: const Color(0xFF005D90),
            onPressed: () => context.push('/patients/new'),
            child: Icon(
              Icons.person_add,
              color: Colors.white,
              size: 28 * scale,
            ),
          ),
        ),
      ),
      extendBody: true,
      bottomNavigationBar: const ClinicBottomNav(
        selectedTab: ClinicBottomTab.patients,
      ),
    );
  }
}

class _SearchBox extends StatelessWidget {
  const _SearchBox({required this.scale});

  final double scale;

  @override
  Widget build(BuildContext context) {
    return TextField(
      decoration: InputDecoration(
        isDense: true,
        hintText: 'Ad veya TC Kimlik No ile ara...',
        hintStyle: GoogleFonts.inter(
          fontSize: 14 * scale,
          fontWeight: FontWeight.w500,
          color: const Color(0xFF707881),
        ),
        prefixIcon: Icon(
          Icons.search,
          color: const Color(0xFF707881),
          size: 22 * scale,
        ),
        filled: true,
        fillColor: const Color(0xFFE0E3E5),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        contentPadding: EdgeInsets.symmetric(vertical: 16 * scale),
      ),
      style: GoogleFonts.inter(
        fontSize: 14 * scale,
        fontWeight: FontWeight.w600,
        color: const Color(0xFF191C1E),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.scale,
    required this.onTap,
  });

  final String label;
  final bool active;
  final double scale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 44 * scale,
        padding: EdgeInsets.symmetric(horizontal: 12 * scale),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF005D90) : const Color(0xFFE6E8EA),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.inter(
                  fontSize: 13.5 * scale,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : const Color(0xFF191C1E),
                ),
              ),
            ),
            Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 19 * scale,
              color: active ? Colors.white : const Color(0xFF3D494C),
            ),
          ],
        ),
      ),
    );
  }
}

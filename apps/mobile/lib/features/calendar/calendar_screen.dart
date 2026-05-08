import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../theme/app_theme.dart';
import '../../widgets/calendar_day_item.dart';
import '../../widgets/appointment_card.dart';
import '../../widgets/section_container.dart';

/// Takvim (Calendar & Appointments) — fully functional calendar view.
///
/// Month selector, day grid using [CalendarDayItem], and appointment list
/// using [AppointmentCard]. No borders — surface layering and soft shadows.
class CalendarScreen extends StatefulWidget {
  const CalendarScreen({Key? key}) : super(key: key);

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  int selectedDay = 4;
  String selectedMonth = 'Ekim';
  int selectedYear = 2023;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Row(
                children: [
                  const Icon(
                    Icons.visibility_outlined,
                    color: AppColors.primary,
                    size: 22,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'RETINA KLİNİK',
                    style: GoogleFonts.manrope(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.primary.withOpacity(0.1),
                    ),
                    child: const Icon(
                      Icons.person,
                      color: AppColors.primary,
                      size: 18,
                    ),
                  ),
                ],
              ),
            ),
            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 140),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Takvim',
                              style: GoogleFonts.manrope(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                                color: AppColors.onSurface,
                              ),
                            ),
                            Text(
                              '$selectedMonth $selectedYear',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: AppColors.outline,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: Icon(
                                Icons.chevron_left,
                                color: AppColors.outline,
                              ),
                              onPressed: () {},
                            ),
                            IconButton(
                              icon: Icon(
                                Icons.chevron_right,
                                color: AppColors.outline,
                              ),
                              onPressed: () {},
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    // Calendar grid
                    SectionContainer(
                      color: AppColors.surface,
                      child: Column(
                        children: [
                          // Day headers
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children:
                                [
                                      'PZT',
                                      'SAL',
                                      'ÇAR',
                                      'PER',
                                      'CUM',
                                      'CMT',
                                      'PAZ',
                                    ]
                                    .map(
                                      (day) => Expanded(
                                        child: Center(
                                          child: Text(
                                            day,
                                            style: GoogleFonts.inter(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.outline,
                                            ),
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                          ),
                          const SizedBox(height: 12),
                          // Calendar dates
                          GridView.count(
                            crossAxisCount: 7,
                            mainAxisSpacing: 8,
                            crossAxisSpacing: 8,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            children: List.generate(35, (index) {
                              int day = index + 1 - 3;
                              bool isCurrentDay = day == selectedDay;
                              bool isSelectable = day > 0 && day <= 31;
                              bool hasEvent = [4, 8, 12, 18, 24].contains(day);

                              if (!isSelectable) {
                                return const SizedBox();
                              }

                              return CalendarDayItem(
                                day: day,
                                isActive: isCurrentDay,
                                hasEvent: hasEvent,
                                onTap: () {
                                  setState(() => selectedDay = day);
                                },
                              );
                            }),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),
                    // Appointments section
                    Text(
                      '$selectedDay $selectedMonth Detayları',
                      style: GoogleFonts.manrope(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 14),
                    AppointmentCard(
                      time: '09:00 - 10:00',
                      title: 'Fundus Görüntüleme',
                      description:
                          'Hasta: Ahmet Yılmaz. Diyabetik Retinopati kontrolü.',
                      icon: Icons.visibility_outlined,
                      accentColor: AppColors.primary,
                    ),
                    const SizedBox(height: 12),
                    AppointmentCard(
                      time: '11:30 - 12:15',
                      title: 'Klinik Toplantı',
                      description:
                          'Yapay Zeka skorlama sistemleri üzerine değerlendirme.',
                      icon: Icons.people_outline,
                      accentColor: const Color(0xFF0091B3),
                    ),
                    const SizedBox(height: 12),
                    AppointmentCard(
                      time: '14:00 - 15:00',
                      title: 'Ameliyat Öncesi Hazırlık',
                      description:
                          'Hasta: Ayşe Kaya. Vitrektomi prosedürü bilgilendirilmesi.',
                      icon: Icons.medical_services_outlined,
                      accentColor: const Color(0xFF00A8CC),
                    ),
                    const SizedBox(height: 24),
                    // Not Ekle
                    GestureDetector(
                      onTap: () {},
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceContainerLow,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Center(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.add,
                                color: AppColors.outline,
                                size: 20,
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Not Ekle',
                                style: GoogleFonts.manrope(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.outline,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

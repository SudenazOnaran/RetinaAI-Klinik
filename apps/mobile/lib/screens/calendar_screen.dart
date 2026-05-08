import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';

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
      appBar: AppBar(
        leading: Icon(Icons.visibility_outlined, color: Color(0xFF00687a)),
        title: Text(
          'RETINA KLİNİK',
          style: GoogleFonts.manrope(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: Color(0xFF00687a),
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleAvatar(
              backgroundColor: Color(0xFF00687a),
              child: Icon(Icons.person, color: Colors.white, size: 20),
            ),
          ),
        ],
        backgroundColor: Colors.white,
        elevation: 1,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
        child: Column(
          children: [
            // Success banner
            Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Color(0xFFE8F5E9),
              child: Row(
                children: [
                  Icon(Icons.check_circle, color: Color(0xFF4CAF50), size: 20),
                  SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Yeni randevu başarıyla oluşturuldu.',
                      style: GoogleFonts.inter(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: Color(0xFF2E7D32),
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {},
                    child: Icon(
                      Icons.close,
                      color: Color(0xFF2E7D32),
                      size: 18,
                    ),
                  ),
                ],
              ),
            ),

            // Main content
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Month and navigation
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
                              color: Colors.black,
                            ),
                          ),
                          Text(
                            '$selectedMonth $selectedYear',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              color: Colors.grey[600],
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: Icon(
                              Icons.chevron_left,
                              color: Colors.grey[600],
                            ),
                            onPressed: () {},
                          ),
                          IconButton(
                            icon: Icon(
                              Icons.chevron_right,
                              color: Colors.grey[600],
                            ),
                            onPressed: () {},
                          ),
                        ],
                      ),
                    ],
                  ),
                  SizedBox(height: 16),

                  // View mode buttons
                  Row(
                    children: [
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Color(0xFFF5F7FA),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.grey[300]!),
                        ),
                        child: Row(
                          children: [
                            Text(
                              'AY',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey[700],
                              ),
                            ),
                            SizedBox(width: 4),
                            Icon(
                              Icons.unfold_more,
                              size: 14,
                              color: Colors.grey[600],
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: 12),
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: Color(0xFFF5F7FA),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.grey[300]!),
                        ),
                        child: Row(
                          children: [
                            Text(
                              'HAFTA',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey[700],
                              ),
                            ),
                            SizedBox(width: 4),
                            Icon(
                              Icons.unfold_more,
                              size: 14,
                              color: Colors.grey[600],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 24),

                  // Calendar grid
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    padding: EdgeInsets.all(16),
                    child: Column(
                      children: [
                        // Day headers
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children:
                              ['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT', 'PAZ']
                                  .map(
                                    (day) => Expanded(
                                      child: Center(
                                        child: Text(
                                          day,
                                          style: GoogleFonts.inter(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w600,
                                            color: Colors.grey[600],
                                          ),
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                        ),
                        SizedBox(height: 12),
                        // Calendar dates
                        GridView.count(
                          crossAxisCount: 7,
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                          shrinkWrap: true,
                          physics: NeverScrollableScrollPhysics(),
                          children: List.generate(35, (index) {
                            int day = index + 1 - 3;
                            bool isCurrentDay = day == selectedDay;
                            bool isSelectable = day > 0 && day <= 31;

                            if (!isSelectable) {
                              return SizedBox();
                            }

                            return GestureDetector(
                              onTap: () {
                                setState(() => selectedDay = day);
                              },
                              child: Container(
                                decoration: BoxDecoration(
                                  color: isCurrentDay
                                      ? Color(0xFF00687a)
                                      : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                  border: isCurrentDay
                                      ? null
                                      : Border.all(
                                          color: Colors.grey[200]!,
                                          width: 1,
                                        ),
                                ),
                                child: Center(
                                  child: Text(
                                    '$day',
                                    style: GoogleFonts.manrope(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: isCurrentDay
                                          ? Colors.white
                                          : Colors.black,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 32),

                  // Appointments section
                  Text(
                    '$selectedDay $selectedMonth Detayları',
                    style: GoogleFonts.manrope(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.black,
                    ),
                  ),
                  SizedBox(height: 12),

                  // Appointment card 1
                  _buildAppointmentCard(
                    '09:00 - 10:00',
                    'Fundus Görüntüleme',
                    'Hasta: Ahmet Yılmaz. Diyabetik Retinopati kontrolü.',
                    Icons.visibility_outlined,
                    Color(0xFF00687a),
                  ),
                  SizedBox(height: 12),

                  // Appointment card 2
                  _buildAppointmentCard(
                    '11:30 - 12:15',
                    'Klinik Toplantı',
                    'Yapay Zeka skorlama sistemleri üzerine değerlendirme.',
                    Icons.people_outline,
                    Color(0xFF0091B3),
                  ),
                  SizedBox(height: 12),

                  // Appointment card 3
                  _buildAppointmentCard(
                    '14:00 - 15:00',
                    'Ameliyat Öncesi Hazırlık',
                    'Hasta: Ayşe Kaya. Vitrektomi prosedürü bilgilendirilmesi.',
                    Icons.medical_services_outlined,
                    Color(0xFF00A8CC),
                  ),
                  SizedBox(height: 32),

                  // Not Ekle button
                  GestureDetector(
                    onTap: () {},
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: Colors.grey[300]!,
                          width: 1,
                          style: BorderStyle.solid,
                        ),
                      ),
                      child: Center(
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add, color: Colors.grey[600], size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Not Ekle',
                              style: GoogleFonts.manrope(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Colors.grey[600],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  SizedBox(height: 40),
                ],
              ),
            ),
          ],
        ),
      ),
            ),
          ],
        ),
      ),
      extendBody: true,
      bottomNavigationBar: const ClinicBottomNav(
        selectedTab: ClinicBottomTab.panel,
      ),
    );
  }

  Widget _buildAppointmentCard(
    String time,
    String title,
    String description,
    IconData icon,
    Color color,
  ) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border(
          left: BorderSide(color: color, width: 4),
          top: BorderSide(color: Colors.grey[200]!, width: 1),
          right: BorderSide(color: Colors.grey[200]!, width: 1),
          bottom: BorderSide(color: Colors.grey[200]!, width: 1),
        ),
      ),
      padding: EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 20),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      time,
                      style: GoogleFonts.manrope(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.black,
                      ),
                    ),
                    Text(
                      title,
                      style: GoogleFonts.manrope(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey[700],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          Text(
            description,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w400,
              color: Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }
}

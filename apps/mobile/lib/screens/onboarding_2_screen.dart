import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

class Onboarding2Screen extends StatelessWidget {
  const Onboarding2Screen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    const background = Color(0xFFF7F9FB);
    const primary = Color(0xFF00687A);
    const primaryContainer = Color(0xFF06B6D4);
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 390).clamp(0.78, 1.0);

    return Scaffold(
      backgroundColor: background,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onHorizontalDragEnd: (details) {
          final velocity = details.primaryVelocity ?? 0;
          if (velocity < -200) {
            context.go('/onboarding3');
          } else if (velocity > 200) {
            context.go('/onboarding1');
          }
        },
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: 18 * scale,
                  vertical: 14 * scale,
                ),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => context.go('/signin'),
                    child: Text(
                      'Atla',
                      style: GoogleFonts.inter(
                        fontSize: 15 * scale,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF565E74),
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 18 * scale),
                    child: Column(
                      children: [
                        SizedBox(height: 4 * scale),
                        SizedBox(
                          width: double.infinity,
                          child: AspectRatio(
                            aspectRatio: 1,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Positioned.fill(
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFFDAE2FD,
                                      ).withOpacity(0.2),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: 24 * scale,
                                  right: 24 * scale,
                                  top: 34 * scale,
                                  bottom: 34 * scale,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(18),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Color(0x14000000),
                                          blurRadius: 24,
                                          offset: Offset(0, 12),
                                        ),
                                      ],
                                    ),
                                    padding: EdgeInsets.all(14 * scale),
                                    child: Column(
                                      children: [
                                        SizedBox(height: 6 * scale),
                                        Container(
                                          width: 76 * scale,
                                          height: 76 * scale,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                              color: const Color(0xFFE6E8EA),
                                              width: 2,
                                            ),
                                          ),
                                          clipBehavior: Clip.antiAlias,
                                          child: Image.network(
                                            'https://lh3.googleusercontent.com/aida-public/AB6AXuD2pXB1E4iNJiWvaMioQV8XlzgiPtijLis2Nawmnm1KnCjdP-aIoByzCiaohWDFm3F7oqgG964tzRQrnGKuYSx38OezLamJl9ap_SyMoITPtH2HE5WJDakMwANDITy0kD1LNXSzTcekL6ctHV8NDt9ZjIZGf02pN4R6JHmpbxg2Nav8OlYnhXjq-03_G2gSszSJ48tBQNT97VnQBkJ5wltEwPv5iG9WjbeeFRMxrLGHxflP-eUdVDQYrD5R_T5ZzMyg5WUH9bE7Ly3b',
                                            fit: BoxFit.cover,
                                          ),
                                        ),
                                        SizedBox(height: 10 * scale),
                                        Text(
                                          'Selina Yılmaz',
                                          style: GoogleFonts.manrope(
                                            fontSize: 15 * scale,
                                            fontWeight: FontWeight.w700,
                                            color: const Color(0xFF191C1E),
                                          ),
                                        ),
                                        Text(
                                          'ID: 88291-C',
                                          style: GoogleFonts.inter(
                                            fontSize: 11 * scale,
                                            fontWeight: FontWeight.w500,
                                            color: const Color(0xFF5C647A),
                                          ),
                                        ),
                                        SizedBox(height: 16 * scale),
                                        Align(
                                          alignment: Alignment.centerLeft,
                                          child: Text(
                                            'TEDAVİ SÜRECİ',
                                            style: GoogleFonts.inter(
                                              fontSize: 8.5 * scale,
                                              letterSpacing: 1.1,
                                              fontWeight: FontWeight.w700,
                                              color: const Color(0xFF3D494C),
                                            ),
                                          ),
                                        ),
                                        SizedBox(height: 8 * scale),
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(
                                            999,
                                          ),
                                          child: LinearProgressIndicator(
                                            value: 0.85,
                                            minHeight: 8 * scale,
                                            backgroundColor: const Color(
                                              0xFFE0E3E5,
                                            ),
                                            valueColor:
                                                const AlwaysStoppedAnimation(
                                                  primaryContainer,
                                                ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: -4 * scale,
                                  top: 70 * scale,
                                  child: Transform.rotate(
                                    angle: -4 * math.pi / 180,
                                    child: Container(
                                      width: 166 * scale,
                                      padding: EdgeInsets.all(10 * scale),
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(14),
                                        boxShadow: const [
                                          BoxShadow(
                                            color: Color(0x12000000),
                                            blurRadius: 18,
                                            offset: Offset(0, 6),
                                          ),
                                        ],
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Container(
                                                width: 30 * scale,
                                                height: 30 * scale,
                                                decoration: BoxDecoration(
                                                  color: primaryContainer
                                                      .withOpacity(0.22),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: Icon(
                                                  Icons.badge_rounded,
                                                  color: primary,
                                                  size: 16 * scale,
                                                ),
                                              ),
                                              SizedBox(width: 8 * scale),
                                              Container(
                                                width: 70 * scale,
                                                height: 10 * scale,
                                                decoration: BoxDecoration(
                                                  color: const Color(
                                                    0xFFE0E3E5,
                                                  ),
                                                  borderRadius:
                                                      BorderRadius.circular(
                                                        999,
                                                      ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          SizedBox(height: 10 * scale),
                                          _line(124 * scale),
                                          SizedBox(height: 6 * scale),
                                          _line(92 * scale),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  right: -10 * scale,
                                  bottom: 76 * scale,
                                  child: Transform.rotate(
                                    angle: 6 * math.pi / 180,
                                    child: Container(
                                      width: 188 * scale,
                                      padding: EdgeInsets.all(10 * scale),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withOpacity(0.82),
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                          color: primaryContainer.withOpacity(
                                            0.45,
                                          ),
                                        ),
                                        boxShadow: const [
                                          BoxShadow(
                                            color: Color(0x14000000),
                                            blurRadius: 18,
                                            offset: Offset(0, 7),
                                          ),
                                        ],
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Icon(
                                                Icons.auto_awesome,
                                                color: primary,
                                                size: 14 * scale,
                                              ),
                                              SizedBox(width: 6 * scale),
                                              Text(
                                                'AI Analizi',
                                                style: GoogleFonts.manrope(
                                                  fontSize: 13 * scale,
                                                  fontWeight: FontWeight.w800,
                                                  color: const Color(
                                                    0xFF00424F,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                          SizedBox(height: 6 * scale),
                                          Text(
                                            'Hastanın son tahlil sonuçları\niyileşme eğiliminde. Bir sonraki\nseans dozajı %10 azaltılabilir.',
                                            style: GoogleFonts.inter(
                                              fontSize: 10.5 * scale,
                                              height: 1.5,
                                              fontWeight: FontWeight.w500,
                                              color: const Color(0xFF3D494C),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        SizedBox(height: 24 * scale),
                        Text(
                          'Kapsamlı Hasta\nYönetimi',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.manrope(
                            fontSize: 34 * scale,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF191C1E),
                            letterSpacing: -0.8,
                            height: 1.10,
                          ),
                        ),
                        SizedBox(height: 14 * scale),
                        Text(
                          'Hastalarınızın tedavi süreçlerini ve geçmiş\nanalizlerini tek bir yerden kolayca takip edin.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 13 * scale,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xFF565E74),
                            height: 1.45,
                          ),
                        ),
                        SizedBox(height: 24 * scale),
                      ],
                    ),
                  ),
                ),
              ),
              Container(
                width: double.infinity,
                padding: EdgeInsets.fromLTRB(
                  18 * scale,
                  0,
                  18 * scale,
                  20 * scale,
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _dot(false),
                        SizedBox(width: 10 * scale),
                        Container(
                          width: 36 * scale,
                          height: 9 * scale,
                          decoration: BoxDecoration(
                            color: primaryContainer,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                        SizedBox(width: 10 * scale),
                        _dot(false),
                      ],
                    ),
                    SizedBox(height: 20 * scale),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: [
                          BoxShadow(
                            color: primary.withOpacity(0.20),
                            blurRadius: 28,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: () => context.go('/onboarding3'),
                        style: ElevatedButton.styleFrom(
                          elevation: 0,
                          backgroundColor: Colors.transparent,
                          minimumSize: Size(double.infinity, 56 * scale),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(999),
                          ),
                          padding: EdgeInsets.zero,
                        ),
                        child: Ink(
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [primary, primaryContainer],
                            ),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Container(
                            height: 56 * scale,
                            alignment: Alignment.center,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Sonraki',
                                  style: GoogleFonts.manrope(
                                    fontSize: 20 * scale,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white,
                                  ),
                                ),
                                SizedBox(width: 6 * scale),
                                Icon(
                                  Icons.arrow_forward_rounded,
                                  color: Colors.white,
                                  size: 20 * scale,
                                ),
                              ],
                            ),
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
    );
  }

  Widget _line(double width) {
    return Container(
      width: width,
      height: 6,
      decoration: BoxDecoration(
        color: const Color(0xFFE0E3E5),
        borderRadius: BorderRadius.circular(999),
      ),
    );
  }

  Widget _dot(bool active) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: active ? const Color(0xFF06B6D4) : const Color(0xFFC5CFD9),
        shape: BoxShape.circle,
      ),
    );
  }
}

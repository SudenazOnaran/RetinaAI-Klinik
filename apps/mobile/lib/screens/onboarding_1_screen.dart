import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';

class Onboarding1Screen extends StatelessWidget {
  const Onboarding1Screen({Key? key}) : super(key: key);

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
            context.go('/onboarding2');
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
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.badge_rounded,
                          color: primary,
                          size: 20 * scale,
                        ),
                        SizedBox(width: 8 * scale),
                        Text(
                          'Clinical Curator',
                          style: GoogleFonts.manrope(
                            fontSize: 18 * scale,
                            fontWeight: FontWeight.w700,
                            color: primary,
                            letterSpacing: -0.3,
                          ),
                        ),
                      ],
                    ),
                    TextButton(
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
                  ],
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 18 * scale),
                    child: Column(
                      children: [
                        SizedBox(height: 18 * scale),
                        SizedBox(
                          width: double.infinity,
                          child: AspectRatio(
                            aspectRatio: 1,
                            child: Stack(
                              children: [
                                Positioned.fill(
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: primaryContainer.withOpacity(0.10),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: 0,
                                  right: 0,
                                  top: 10,
                                  bottom: 10,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: Colors.white.withOpacity(0.18),
                                      borderRadius: BorderRadius.circular(26),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Color(0x12000000),
                                          blurRadius: 22,
                                          offset: Offset(0, 8),
                                        ),
                                      ],
                                    ),
                                    clipBehavior: Clip.antiAlias,
                                    child: Stack(
                                      fit: StackFit.expand,
                                      children: [
                                        Image.network(
                                          'https://lh3.googleusercontent.com/aida-public/AB6AXuBsnI9-5qq5cpoBTaDNk12cOhWsHbG147JH8Q3sw9fHyPVywEnDuj2i8PBLYBa937o72ARo13JWGpgoGau6pZryZPJ6isHsSh75aPoZY5lmOWPp-CsV4yADsaVy7OfSDcREpWMfUCvaPkT8NRRrFD17hM5vpfMEgzyil5B977MaRB4JrFMZ8PY5Z_If78jntLqHHmO3_YJ6lLVGrTJahVH5U35GTCCN8STT_oSfE_TWRwWqOOQbtdnCK9fYAkCBYM7oIDpRDwRDbpKJ',
                                          fit: BoxFit.cover,
                                        ),
                                        Container(
                                          decoration: BoxDecoration(
                                            gradient: LinearGradient(
                                              begin: Alignment.topCenter,
                                              end: Alignment.bottomCenter,
                                              colors: [
                                                Colors.black.withOpacity(0.12),
                                                Colors.black.withOpacity(0.28),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                Positioned(
                                  right: -8,
                                  bottom: 36 * scale,
                                  child: Container(
                                    width: 150 * scale,
                                    padding: EdgeInsets.all(10 * scale),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border(
                                        left: BorderSide(
                                          color: primary,
                                          width: 3 * scale,
                                        ),
                                      ),
                                      boxShadow: const [
                                        BoxShadow(
                                          color: Color(0x1A000000),
                                          blurRadius: 16,
                                          offset: Offset(0, 8),
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
                                              Icons.bolt,
                                              color: primary,
                                              size: 14 * scale,
                                            ),
                                            SizedBox(width: 6 * scale),
                                            Text(
                                              'REAL-TIME',
                                              style: GoogleFonts.manrope(
                                                fontSize: 9 * scale,
                                                fontWeight: FontWeight.w800,
                                                color: const Color(0xFF3D494C),
                                                letterSpacing: 0.8,
                                              ),
                                            ),
                                          ],
                                        ),
                                        SizedBox(height: 6 * scale),
                                        Text(
                                          '99.8%',
                                          style: GoogleFonts.manrope(
                                            fontSize: 30 * scale,
                                            fontWeight: FontWeight.w800,
                                            color: primary,
                                            height: 1,
                                          ),
                                        ),
                                        SizedBox(height: 2 * scale),
                                        Text(
                                          'Analiz Doğruluğu',
                                          style: GoogleFonts.inter(
                                            fontSize: 10 * scale,
                                            fontWeight: FontWeight.w500,
                                            color: const Color(0xFF3D494C),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        SizedBox(height: 26 * scale),
                        Text(
                          'Yapay Zeka Destekli\nAnaliz',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.manrope(
                            fontSize: 36 * scale,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF191C1E),
                            height: 1.10,
                            letterSpacing: -0.8,
                          ),
                        ),
                        SizedBox(height: 14 * scale),
                        Text(
                          'Derin öğrenme algoritmalarıyla retina\ntaramalarınızı saniyeler içinde analiz\nedin. Klinik mükemmellik için tasarlanmış\nhassas tespitler.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.inter(
                            fontSize: 13 * scale,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xFF3D494C),
                            height: 1.45,
                          ),
                        ),
                        SizedBox(height: 26 * scale),
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
                        Container(
                          width: 10 * scale,
                          height: 10 * scale,
                          decoration: const BoxDecoration(
                            color: primaryContainer,
                            shape: BoxShape.circle,
                          ),
                        ),
                        SizedBox(width: 10 * scale),
                        _dot(false),
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
                            color: primary.withOpacity(0.22),
                            blurRadius: 28,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: () => context.go('/onboarding2'),
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
                              colors: [primaryContainer, primary],
                            ),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Container(
                            alignment: Alignment.center,
                            height: 56 * scale,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  'Sonraki',
                                  style: GoogleFonts.manrope(
                                    fontSize: 20 * scale,
                                    fontWeight: FontWeight.w700,
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

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';

class Onboarding3Screen extends StatelessWidget {
  const Onboarding3Screen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    const background = Color(0xFFF7F9FB);
    const primary = Color(0xFF00687A);
    const primaryContainer = Color(0xFF06B6D4);
    const onSurface = Color(0xFF191C1E);
    const onSurfaceVariant = Color(0xFF3D494C);
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 390).clamp(0.78, 1.0);

    return Scaffold(
      backgroundColor: background,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onHorizontalDragEnd: (details) {
          final velocity = details.primaryVelocity ?? 0;
          if (velocity > 200) {
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
                  children: [
                    Icon(Icons.badge_rounded, color: primary, size: 20 * scale),
                    SizedBox(width: 8 * scale),
                    Text(
                      'Clinical Curator',
                      style: GoogleFonts.manrope(
                        fontSize: 18 * scale,
                        fontWeight: FontWeight.w700,
                        color: primary,
                        letterSpacing: -0.2,
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
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        SizedBox(height: 4 * scale),
                        SizedBox(
                          width: double.infinity,
                          child: AspectRatio(
                            aspectRatio: 1,
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Positioned(
                                  child: Container(
                                    width: 220 * scale,
                                    height: 220 * scale,
                                    decoration: BoxDecoration(
                                      color: primaryContainer.withOpacity(0.20),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  child: Container(
                                    width: 150 * scale,
                                    height: 150 * scale,
                                    decoration: BoxDecoration(
                                      color: const Color(
                                        0xFF23B2EC,
                                      ).withOpacity(0.10),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                ),
                                Container(
                                  width: 250 * scale,
                                  height: 250 * scale,
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(18),
                                    boxShadow: const [
                                      BoxShadow(
                                        color: Color(0x14000000),
                                        blurRadius: 18,
                                        offset: Offset(0, 8),
                                      ),
                                    ],
                                  ),
                                  clipBehavior: Clip.antiAlias,
                                  child: Stack(
                                    fit: StackFit.expand,
                                    children: [
                                      Image.network(
                                        'https://lh3.googleusercontent.com/aida-public/AB6AXuALqkoTQvYHyld2PbWa00XMiyD3mFWvFCXGHeHj18xOlIWtAcnHcvGDPeRgZiN1JKssu313PrGu7YEU9IuAot1nl9-0-W4XigWPUysdnmp1HBkBHD7Cm3U_W_g51XowXMAUXbYV0JSQiMKb6rcZi5qm_Ej4yXO9dh5glOPQf_l3MiM28ukRWmycraVoYD84HIF8G0nXXdds0J-FJRAXW2e4UNx0SMG5qPcqkL6dvnG3v5qBHk7sElsR0S7dRfiOdrvDTl193MFv_UFr',
                                        fit: BoxFit.cover,
                                      ),
                                      Container(
                                        decoration: BoxDecoration(
                                          gradient: LinearGradient(
                                            begin: Alignment.topCenter,
                                            end: Alignment.bottomCenter,
                                            colors: [
                                              primary.withOpacity(0.06),
                                              primary.withOpacity(0.30),
                                            ],
                                          ),
                                        ),
                                      ),
                                      Center(
                                        child: Container(
                                          width: 110 * scale,
                                          height: 110 * scale,
                                          decoration: BoxDecoration(
                                            color: Colors.white.withOpacity(
                                              0.72,
                                            ),
                                            shape: BoxShape.circle,
                                          ),
                                          child: Icon(
                                            Icons.shield_rounded,
                                            size: 56 * scale,
                                            color: primary,
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
                        SizedBox(height: 24 * scale),
                        Text(
                          'Güvenli Arşivleme',
                          style: GoogleFonts.manrope(
                            fontSize: 22 * scale,
                            fontWeight: FontWeight.w800,
                            color: onSurface,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 10 * scale),
                        Text(
                          'KVKK ve HIPAA uyumlu altyapımızla\nverileriniz uçtan uca şifrelenmiş\nolarak depolanır.',
                          style: GoogleFonts.inter(
                            fontSize: 12 * scale,
                            fontWeight: FontWeight.w500,
                            color: onSurfaceVariant,
                            height: 1.5,
                          ),
                          textAlign: TextAlign.center,
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
                        _dot(false),
                        SizedBox(width: 10 * scale),
                        _dot(true),
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
                        onPressed: () => context.go('/signin'),
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
                            child: Text(
                              'Başla',
                              style: GoogleFonts.manrope(
                                fontSize: 20 * scale,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
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
      width: active ? 9 : 7,
      height: active ? 9 : 7,
      decoration: BoxDecoration(
        color: active ? const Color(0xFF06B6D4) : const Color(0xFFC5CFD9),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

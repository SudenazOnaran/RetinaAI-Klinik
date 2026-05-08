import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:math' as math;
import '../services/auth_service.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with TickerProviderStateMixin {
  late AnimationController _entryController;
  late AnimationController _loopController;

  @override
  void initState() {
    super.initState();
    _entryController = AnimationController(
      duration: const Duration(milliseconds: 1400),
      vsync: this,
    );
    _loopController = AnimationController(
      duration: const Duration(seconds: 16),
      vsync: this,
    );

    _entryController.forward();
    _loopController.repeat();

    // Zaten giriş yapmış mı? → doğrudan /home'a yönlendir
    _checkAuthAndRedirect();
  }

  Future<void> _checkAuthAndRedirect() async {
    final loggedIn = await AuthService.instance.isLoggedIn();
    if (!mounted) return;

    // İlk açılışta tıbbi sorumluluk reddi göster
    final prefs = await SharedPreferences.getInstance();
    final disclaimerAccepted = prefs.getBool('disclaimer_accepted') ?? false;
    if (!disclaimerAccepted && mounted) {
      await _showDisclaimerDialog();
    }

    if (!mounted) return;
    if (loggedIn) {
      await Future.delayed(const Duration(milliseconds: 800));
      if (!mounted) return;
      context.go('/home');
    }
  }

  Future<void> _showDisclaimerDialog() async {
    final prefs = await SharedPreferences.getInstance();
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Tıbbi Sorumluluk Bildirimi',
          style: GoogleFonts.manrope(fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Retina AI Klinik uygulaması yalnızca lisanslı sağlık profesyonellerine yöneliktir.\n\n'
          'Bu uygulama; yapay zeka destekli görüntü analizi sunmakta olup kesin tıbbi tanı, tedavi veya '
          'ilaç önerisi yerine geçmez. Tüm klinik kararlar yetkili bir hekim tarafından verilmelidir.\n\n'
          'Uygulamayı kullanarak bu bildirimi okuduğunuzu ve kabul ettiğinizi onaylarsınız.',
          style: GoogleFonts.inter(fontSize: 13, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await prefs.setBool('disclaimer_accepted', true);
              if (ctx.mounted) Navigator.of(ctx).pop();
            },
            child: Text(
              'Anladım ve Kabul Ediyorum',
              style: GoogleFonts.manrope(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _entryController.dispose();
    _loopController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final scale = (size.width / 390).clamp(0.72, 1.0);
    final textScale = scale * 0.92;

    return Scaffold(
      body: AnimatedBuilder(
        animation: _loopController,
        builder: (context, _) {
          final t = _loopController.value * math.pi * 2;
          final pulse = 0.92 + (math.sin(t * 1.8) * 0.08);
          final glow = 0.20 + ((math.sin(t * 2.2) + 1) * 0.12);

          return Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.35),
                radius: 1.25,
                colors: [Color(0xFF083344), Color(0xFF020617)],
              ),
            ),
            child: Stack(
              fit: StackFit.expand,
              children: [
                Positioned(
                  top: size.height * 0.16 + (math.sin(t) * 14),
                  left: -90 + (math.cos(t * 0.7) * 12),
                  child: _BlurBlob(
                    size: 260,
                    color: const Color(0xFF06B6D4).withOpacity(0.12),
                  ),
                ),
                Positioned(
                  bottom: size.height * 0.18 + (math.cos(t * 0.85) * 16),
                  right: -110 + (math.sin(t * 0.6) * 16),
                  child: _BlurBlob(
                    size: 320,
                    color: const Color(0xFF0E7490).withOpacity(0.16),
                  ),
                ),
                Center(
                  child: Opacity(
                    opacity: 0.32,
                    child: Transform.rotate(
                      angle: t * 0.06,
                      child: _RetinaBackground(pulse: pulse),
                    ),
                  ),
                ),
                SafeArea(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 24 * scale),
                    child: Column(
                      children: [
                        SizedBox(height: 26 * scale),
                        _fadeUp(
                          begin: 0.00,
                          end: 0.35,
                          child: Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SvgPicture.asset(
                                    'retina-ai.svg',
                                    width: 60 * scale,
                                    height: 60 * scale,
                                    colorFilter: const ColorFilter.mode(
                                      Color(0xFF22D3EE),
                                      BlendMode.srcIn,
                                    ),
                                  ),
                                  SizedBox(width: 14 * scale),
                                  Flexible(
                                    child: FittedBox(
                                      fit: BoxFit.scaleDown,
                                      child: Text(
                                        'RETINA AI',
                                        style: GoogleFonts.manrope(
                                          fontSize: 40 * textScale,
                                          fontWeight: FontWeight.w800,
                                          color: const Color(0xFFF8FAFC),
                                          letterSpacing: -0.9,
                                          height: 0.95,
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              SizedBox(height: 14 * scale),
                              Container(
                                width: 86 * scale,
                                height: 2 * scale,
                                decoration: BoxDecoration(
                                  color: const Color(
                                    0xFF06B6D4,
                                  ).withOpacity(0.8),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(flex: 5),
                        _fadeUp(
                          begin: 0.18,
                          end: 0.55,
                          child: Column(
                            children: [
                              SizedBox(
                                width: double.infinity,
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    'Geleceğin',
                                    style: GoogleFonts.manrope(
                                      fontSize: 60 * textScale,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFFF8FAFC),
                                      letterSpacing: -1.2,
                                      height: 0.95,
                                    ),
                                  ),
                                ),
                              ),
                              ShaderMask(
                                shaderCallback: (bounds) {
                                  return const LinearGradient(
                                    colors: [
                                      Color(0xFF22D3EE),
                                      Color(0xFF67E8F9),
                                    ],
                                  ).createShader(bounds);
                                },
                                child: SizedBox(
                                  width: double.infinity,
                                  child: FittedBox(
                                    fit: BoxFit.scaleDown,
                                    child: Text(
                                      'Vizyonunu',
                                      style: GoogleFonts.manrope(
                                        fontSize: 62 * textScale,
                                        fontWeight: FontWeight.w800,
                                        color: Colors.white,
                                        letterSpacing: -1.4,
                                        height: 0.95,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              SizedBox(
                                width: double.infinity,
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Text(
                                    'Keşfedin',
                                    style: GoogleFonts.manrope(
                                      fontSize: 60 * textScale,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFFF8FAFC),
                                      letterSpacing: -1.2,
                                      height: 0.95,
                                    ),
                                  ),
                                ),
                              ),
                              SizedBox(height: 20 * scale),
                              Text(
                                'Yapay Zeka Destekli Klinik\nMükemmellik',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(
                                  fontSize: 19 * textScale,
                                  fontWeight: FontWeight.w500,
                                  color: const Color(0xFF94A3B8),
                                  height: 1.45,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(flex: 4),
                        _fadeUp(
                          begin: 0.34,
                          end: 0.75,
                          child: Column(
                            children: [
                              Transform.scale(
                                scale: 1 + (math.sin(t * 2.2) * 0.012),
                                child: Container(
                                  width: double.infinity,
                                  height: 72 * scale,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(
                                      40 * scale,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(
                                          0xFF06B6D4,
                                        ).withOpacity(glow),
                                        blurRadius: 36 * scale,
                                        spreadRadius: 1 * scale,
                                        offset: Offset(0, 14 * scale),
                                      ),
                                    ],
                                  ),
                                  child: Material(
                                    color: Colors.transparent,
                                    child: InkWell(
                                      borderRadius: BorderRadius.circular(
                                        40 * scale,
                                      ),
                                      onTap: () => context.go('/onboarding1'),
                                      child: Ink(
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(
                                            40 * scale,
                                          ),
                                          gradient: const LinearGradient(
                                            colors: [
                                              Color(0xFF22D3EE),
                                              Color(0xFF0891B2),
                                            ],
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisAlignment:
                                              MainAxisAlignment.center,
                                          children: [
                                            Text(
                                              'BAŞLA',
                                              style: GoogleFonts.manrope(
                                                fontSize: 24 * textScale,
                                                fontWeight: FontWeight.w800,
                                                color: Colors.white,
                                                letterSpacing: 2.2 * scale,
                                              ),
                                            ),
                                            SizedBox(width: 12 * scale),
                                            Icon(
                                              Icons.arrow_forward_rounded,
                                              color: Colors.white,
                                              size: 30 * scale,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              SizedBox(height: 36 * scale),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Column(
                                    children: [
                                      Text(
                                        'AI Destekli',
                                        style: GoogleFonts.manrope(
                                          fontSize: 22 * textScale,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFFF8FAFC),
                                        ),
                                      ),
                                      Text(
                                        'TEŞHİS SİSTEMİ',
                                        style: GoogleFonts.inter(
                                          fontSize: 10 * textScale,
                                          letterSpacing: 2 * scale,
                                          fontWeight: FontWeight.w500,
                                          color: const Color(0xFF94A3B8),
                                        ),
                                      ),
                                    ],
                                  ),
                                  Container(
                                    margin: EdgeInsets.symmetric(
                                      horizontal: 28 * scale,
                                    ),
                                    width: 1 * scale,
                                    height: 56 * scale,
                                    color: const Color(0xFF334155),
                                  ),
                                  Column(
                                    children: [
                                      Text(
                                        'Premium',
                                        style: GoogleFonts.manrope(
                                          fontSize: 22 * textScale,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFFF8FAFC),
                                        ),
                                      ),
                                      Text(
                                        'HASTA DENEYİMİ',
                                        style: GoogleFonts.inter(
                                          fontSize: 10 * textScale,
                                          letterSpacing: 2 * scale,
                                          fontWeight: FontWeight.w500,
                                          color: const Color(0xFF94A3B8),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        SizedBox(height: 14 * scale),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _fadeUp({
    required double begin,
    required double end,
    required Widget child,
  }) {
    final curve = CurvedAnimation(
      parent: _entryController,
      curve: Interval(begin, end, curve: Curves.easeOutCubic),
    );

    return FadeTransition(
      opacity: curve,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.18),
          end: Offset.zero,
        ).animate(curve),
        child: child,
      ),
    );
  }
}

class _BlurBlob extends StatelessWidget {
  final double size;
  final Color color;

  const _BlurBlob({required this.size, required this.color});

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color,
          boxShadow: [
            BoxShadow(color: color, blurRadius: 90, spreadRadius: 32),
          ],
        ),
      ),
    );
  }
}

class _RetinaBackground extends StatelessWidget {
  final double pulse;

  const _RetinaBackground({required this.pulse});

  @override
  Widget build(BuildContext context) {
    const ringColor = Color(0xFF0EA5C6);

    return SizedBox(
      width: 980,
      height: 980,
      child: Center(
        child: Stack(
          alignment: Alignment.center,
          children: [
            _ring(1.0, ringColor.withOpacity(0.12)),
            _ring(0.78, ringColor.withOpacity(0.16)),
            _ring(0.56, ringColor.withOpacity(0.14)),
            _ring(0.36, ringColor.withOpacity(0.10)),
            SizedBox(
              width: 360,
              height: 360,
              child: CustomPaint(
                painter: _RetinaWebPainter(ringColor.withOpacity(0.18)),
              ),
            ),
            Transform.scale(
              scale: pulse,
              child: Container(
                width: 132,
                height: 132,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF22D3EE).withOpacity(0.42),
                      const Color(0xFF06B6D4).withOpacity(0.08),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _ring(double scale, Color color) {
    return Transform.scale(
      scale: scale,
      child: Container(
        width: 980,
        height: 980,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: color, width: 1),
        ),
      ),
    );
  }
}

class _RetinaWebPainter extends CustomPainter {
  final Color color;

  _RetinaWebPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    for (final factor in [0.25, 0.5, 0.75]) {
      canvas.drawCircle(center, radius * factor, paint);
    }

    canvas.drawLine(
      Offset(center.dx, 0),
      Offset(center.dx, size.height),
      paint,
    );
    canvas.drawLine(Offset(0, center.dy), Offset(size.width, center.dy), paint);
    canvas.drawLine(Offset(0, 0), Offset(size.width, size.height), paint);
    canvas.drawLine(Offset(size.width, 0), Offset(0, size.height), paint);
  }

  @override
  bool shouldRepaint(covariant _RetinaWebPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import '../core/providers/auth_provider.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _rememberMe = false;

  // Colors based on Tailwind config
  static const Color surface = Color(0xFFF7F9FB);
  static const Color onSurface = Color(0xFF191C1E);
  static const Color onSurfaceVariant = Color(0xFF3D494C);
  static const Color surfaceContainerLowest = Color(0xFFFFFFFF);
  static const Color surfaceContainerLow = Color(0xFFF2F4F6);
  static const Color surfaceContainerHighest = Color(0xFFE0E3E5);
  static const Color primary = Color(0xFF00687A);
  static const Color primaryContainer = Color(0xFF06B6D4);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color primaryFixed = Color(0xFFACEDFF);
  static const Color secondary = Color(0xFF565E74);
  static const Color outline = Color(0xFF6D797D);
  static const Color outlineVariant = Color(0xFFBCC9CD);

  /// authProvider'a login iste\u011fi g\u00f6nderir, ba\u015far\u0131da home'a y\u00f6nlendirir.
  Future<void> _handleLogin() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Email ve \u015fifre bo\u015f b\u0131rak\u0131lamaz'),
        ),
      );
      return;
    }
    await ref.read(authProvider.notifier).login(email, password);
    final state = ref.read(authProvider);
    if (!mounted) return;
    if (state.status == AuthStatus.authenticated) {
      context.go('/home');
    } else if (state.error != null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(state.error!)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: surface,
      body: Stack(
        children: [
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isDesktop = screenWidth >= 1024;

                  return Container(
                    width: isDesktop ? 1152 : 500,
                    constraints: BoxConstraints(minHeight: isDesktop ? 700 : 0),
                    decoration: BoxDecoration(
                      color: surfaceContainerLowest,
                      borderRadius: BorderRadius.circular(32),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF191C1E).withOpacity(0.08),
                          offset: const Offset(0, 30),
                          blurRadius: 60,
                          spreadRadius: -12,
                        ),
                        BoxShadow(
                          color: const Color(0xFF191C1E).withOpacity(0.12),
                          offset: const Offset(0, 18),
                          blurRadius: 36,
                          spreadRadius: -18,
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: isDesktop
                        ? IntrinsicHeight(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  flex: 7,
                                  child: _buildDesktopLeftPanel(),
                                ),
                                Expanded(
                                  flex: 5,
                                  child: _buildRightFormPanel(isDesktop: true),
                                ),
                              ],
                            ),
                          )
                        : _buildRightFormPanel(isDesktop: false),
                  );
                },
              ),
            ),
          ),
          if (screenWidth >= 1280)
            Positioned(
              right: 32,
              bottom: 32,
              child: _buildAiInsightCard(context),
            ),
        ],
      ),
    );
  }

  Widget _buildDesktopLeftPanel() {
    return Container(
      color: secondary,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background Image with opacity overlay
          Opacity(
            opacity: 0.8,
            child: Image.network(
              'https://lh3.googleusercontent.com/aida-public/AB6AXuC9x_Qq0JvY0rvvWRh9B_aC99ZN2N6eY3likhU8U_z-3PBsCUzb-T-J5xwRIhcaZ389l6RuvqWtx5oZ1mdWgDUGxuuTXw9eikH6t887yorLF5ZLshKXzv1Hm5rMG9ndybOXyXdpdrRC2rcfjx7PsKpJfsw6QOQd9Bv5SOMvkDrNHlHoqbZkJUQRje0g0PDVCRSw4yDgwLpY2lMWvzSrb16D6uNn26AwQn2kGlRVSxXUpVeK0-UnD8zosto7bTiHyYCVdveh_f89mylF',
              fit: BoxFit.cover,
            ),
          ),
          // Gradient Overlay
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomLeft,
                end: Alignment.topRight,
                colors: [primary.withOpacity(0.4), Colors.transparent],
              ),
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(64.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Logo
                Row(
                  children: [
                    const Icon(Icons.visibility, color: onPrimary, size: 36),
                    const SizedBox(width: 12),
                    Text(
                      'Retina Klinik',
                      style: GoogleFonts.manrope(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: onPrimary,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ],
                ),
                const Spacer(),
                // Middle Text
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Geleceğin Vizyonunu\nBugün Tasarlıyoruz.',
                      style: GoogleFonts.manrope(
                        fontSize: 48,
                        fontWeight: FontWeight.bold,
                        color: onPrimary,
                        height: 1.1,
                        letterSpacing: -1.0,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Klinik mükemmeliyet ve AI destekli hassasiyetin\nbirleştiği dijital platformumuza hoş geldiniz.',
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        color: primaryFixed.withOpacity(0.9),
                        height: 1.6,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 64),
                // Bottom Badges
                Row(
                  children: [
                    _buildBadge(Icons.verified_user, 'ISO 27001 Certified'),
                    const SizedBox(width: 24),
                    _buildBadge(Icons.analytics, 'Clinical Curator v2.4'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, color: primaryFixed, size: 20),
        const SizedBox(width: 8),
        Text(
          text,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: onPrimary,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildRightFormPanel({required bool isDesktop}) {
    return Container(
      color: surfaceContainerLowest,
      padding: EdgeInsets.all(isDesktop ? 64.0 : 32.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (!isDesktop) ...[
            Row(
              children: [
                const Icon(Icons.visibility, color: primary, size: 32),
                const SizedBox(width: 12),
                Text(
                  'Retina Klinik',
                  style: GoogleFonts.manrope(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: primary,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 48),
          ],
          Text(
            'Hoş Geldiniz',
            style: GoogleFonts.manrope(
              fontSize: 30,
              fontWeight: FontWeight.bold,
              color: onSurface,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Lütfen bilgilerinizi kullanarak oturum açın.',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 40),

          // Email Label
          Padding(
            padding: const EdgeInsets.only(left: 4.0, bottom: 8.0),
            child: Text(
              'Email Adresi',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: onSurfaceVariant,
              ),
            ),
          ),
          // Email Field
          TextFormField(
            controller: _emailController,
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w500,
              color: onSurface,
            ),
            decoration: InputDecoration(
              hintText: 'doktor@retinaklinik.com',
              hintStyle: GoogleFonts.inter(color: outline),
              prefixIcon: const Icon(Icons.mail_outline, color: outline),
              filled: true,
              fillColor: surfaceContainerLow,
              contentPadding: const EdgeInsets.symmetric(vertical: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: primary, width: 2),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Password Label & Forgot Password
          Padding(
            padding: const EdgeInsets.only(left: 4.0, bottom: 8.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Şifre',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: onSurfaceVariant,
                  ),
                ),
                GestureDetector(
                  onTap: () {
                    // TODO: Forgot password
                  },
                  child: Text(
                    'Şifremi Unuttum',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      color: primary,
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Password Field
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            style: GoogleFonts.inter(
              fontWeight: FontWeight.w500,
              color: onSurface,
            ),
            decoration: InputDecoration(
              hintText: '••••••••',
              hintStyle: GoogleFonts.inter(color: outline),
              prefixIcon: const Icon(Icons.lock_outline, color: outline),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined,
                  color: outline,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
              filled: true,
              fillColor: surfaceContainerLow,
              contentPadding: const EdgeInsets.symmetric(vertical: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: primary, width: 2),
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Remember Me
          Row(
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: _rememberMe,
                  onChanged: (value) {
                    setState(() {
                      _rememberMe = value ?? false;
                    });
                  },
                  activeColor: primary,
                  checkColor: onPrimary,
                  side: const BorderSide(color: outlineVariant, width: 2),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Oturumu açık tut',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),

          // Login Button
          Container(
            height: 56,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [primaryContainer, primary],
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF191C1E).withOpacity(0.08),
                  offset: const Offset(0, 30),
                  blurRadius: 60,
                  spreadRadius: -12,
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(28),
                onTap: _handleLogin,
                child: Center(
                  child: ref.watch(authProvider).status == AuthStatus.loading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2.5,
                          ),
                        )
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Giriş Yap',
                              style: GoogleFonts.inter(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: onPrimary,
                              ),
                            ),
                            const SizedBox(width: 8),
                            const Icon(
                              Icons.arrow_forward,
                              color: onPrimary,
                              size: 24,
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 24),

          // Divider "veya"
          Row(
            children: [
              const Expanded(
                child: Divider(color: surfaceContainerHighest, thickness: 1),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Text(
                  'VEYA',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: outline,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
              const Expanded(
                child: Divider(color: surfaceContainerHighest, thickness: 1),
              ),
            ],
          ),

          const SizedBox(height: 24),

          // Register Button
          Container(
            height: 56,
            decoration: BoxDecoration(
              color: surfaceContainerLow,
              borderRadius: BorderRadius.circular(28),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(28),
                onTap: () => context.go('/signup'),
                child: Center(
                  child: Text(
                    'Kayıt Ol',
                    style: GoogleFonts.inter(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: onSurface,
                    ),
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 48),

          // Footer
          Text(
            '© 2024 Retina Klinik Professional Suite. Tüm hakları saklıdır.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: onSurfaceVariant.withOpacity(0.6),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAiInsightCard(BuildContext context) {
    return Container(
      width: 320,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.7),
              border: Border.all(color: Colors.white.withOpacity(0.2)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: primaryContainer.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(
                    Icons.auto_awesome,
                    color: primary,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'AI DESTEKLİ ANALİZ',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: primary,
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Giriş yaptıktan sonra retinal tarama verileriniz otomatik olarak senkronize edilecektir.',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: onSurfaceVariant,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}

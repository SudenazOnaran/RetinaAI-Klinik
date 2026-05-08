import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../core/network/api_client.dart';
import '../core/constants/api_constants.dart';

/// Spec §1.5 — Temporary password reset flow.
/// Shown when login returns errorCode PASSWORD_RESET_REQUIRED or TEMP_PASSWORD_EXPIRED.
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _tempPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  bool _obscureTemp = true;
  bool _obscureNew = true;
  bool _isLoading = false;

  static const Color _primary = Color(0xFF00687A);
  static const Color _bg = Color(0xFFF7F9FB);

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final response = await ApiClient.instance.post(
        ApiConstants.resetTempPassword,
        data: {
          'email': _emailController.text.trim().toLowerCase(),
          'temporaryPassword': _tempPasswordController.text,
          'newPassword': _newPasswordController.text,
        },
      );
      final data = response.data as Map<String, dynamic>;
      if (data['success'] == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Şifre başarıyla güncellendi')),
          );
          context.go('/signin');
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(data['error'] ?? 'Hata oluştu')),
          );
        }
      }
    } on DioException catch (e) {
      final msg = (e.response?.data as Map?)?['error'] ?? 'Hata oluştu';
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(msg.toString())));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _tempPasswordController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: _primary),
          onPressed: () => context.go('/signin'),
        ),
        title: Text(
          'Şifre Sıfırla',
          style: GoogleFonts.manrope(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: _primary,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Geçici Şifre ile Değiştir',
                  style: GoogleFonts.manrope(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF111827),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Yöneticinizden aldığınız geçici şifreyi ve yeni şifrenizi girin.',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    color: const Color(0xFF5C6470),
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                _buildField(
                  controller: _emailController,
                  label: 'E-POSTA',
                  hint: 'isim@hastane.com',
                  validator: (v) =>
                      (v == null || !v.contains('@')) ? 'Geçerli email girin' : null,
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 16),
                _buildField(
                  controller: _tempPasswordController,
                  label: 'GEÇİCİ ŞİFRE',
                  hint: 'Tmp-abc123A1',
                  obscure: _obscureTemp,
                  toggleObscure: () =>
                      setState(() => _obscureTemp = !_obscureTemp),
                  validator: (v) =>
                      (v == null || v.isEmpty) ? 'Gerekli alan' : null,
                ),
                const SizedBox(height: 16),
                _buildField(
                  controller: _newPasswordController,
                  label: 'YENİ ŞİFRE',
                  hint: 'En az 10 karakter',
                  obscure: _obscureNew,
                  toggleObscure: () =>
                      setState(() => _obscureNew = !_obscureNew),
                  validator: (v) {
                    if (v == null || v.length < 10) {
                      return 'Şifre en az 10 karakter olmalıdır';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 40),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            'Şifreyi Güncelle',
                            style: GoogleFonts.manrope(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField({
    required TextEditingController controller,
    required String label,
    required String hint,
    bool obscure = false,
    VoidCallback? toggleObscure,
    String? Function(String?)? validator,
    TextInputType? keyboardType,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF3D494C),
            letterSpacing: 0.8,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          keyboardType: keyboardType,
          validator: validator,
          decoration: InputDecoration(
            hintText: hint,
            suffixIcon: toggleObscure != null
                ? IconButton(
                    icon: Icon(
                      obscure ? Icons.visibility_off : Icons.visibility,
                      color: const Color(0xFF6D797D),
                      size: 20,
                    ),
                    onPressed: toggleObscure,
                  )
                : null,
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFBCC9CD)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: Color(0xFFBCC9CD)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _primary, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}

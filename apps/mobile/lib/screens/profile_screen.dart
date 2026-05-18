import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:retina_ai_app/core/config/app_config.dart';
import 'package:retina_ai_app/core/network/api_client.dart';
import 'package:retina_ai_app/core/constants/api_constants.dart';
import 'package:retina_ai_app/core/providers/auth_provider.dart';
import 'package:retina_ai_app/widgets/clinic_app_header.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  static const _primary = Color(0xFF00687A);
  static const _bg = Color(0xFFF2F4F7);

  bool? _isActive;
  String _createdAt = '';
  String _branch = '';
  String _licenseNo = '';
  String _contactPhone = '';
  String _signatureName = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchProfile();
  }

  Future<void> _fetchProfile() async {
    try {
      final res = await ApiClient.instance.get(ApiConstants.doctorProfile);
      final data = res.data as Map<String, dynamic>? ?? {};
      final doctor = data['doctor'] as Map<String, dynamic>? ?? {};
      final profile = data['profile'] as Map<String, dynamic>? ?? {};
      if (mounted) {
        setState(() {
          _isActive = doctor['isActive'] as bool?;
          _createdAt = (doctor['createdAt'] ?? '').toString();
          _branch = profile['branch'] as String? ?? '';
          _licenseNo = profile['licenseNo'] as String? ?? '';
          _contactPhone = profile['contactPhone'] as String? ?? '';
          _signatureName =
              profile['signatureName'] as String? ??
              doctor['name'] as String? ??
              '';
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final doctor = ref.watch(authProvider).doctor;
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 390).clamp(0.82, 1.0);

    final email = doctor?.email ?? '';
    final role = doctor?.role ?? '-';
    final fullName = doctor?.fullName ?? '';
    final specialty = _branch.isNotEmpty ? _branch : (doctor?.specialty ?? '');
    final statusText = _isActive == null
        ? '-'
        : (_isActive! ? 'Aktif' : 'Pasif');
    final statusColor = _isActive == true
        ? const Color(0xFF006645)
        : const Color(0xFF93000A);

    String createdAtFormatted = '-';
    if (_createdAt.isNotEmpty) {
      try {
        final dt = DateTime.parse(_createdAt).toLocal();
        createdAtFormatted =
            '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year} '
            '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}:${dt.second.toString().padLeft(2, '0')}';
      } catch (_) {
        createdAtFormatted = _createdAt;
      }
    }

    final previewName = _signatureName.isNotEmpty
        ? _signatureName
        : (doctor?.name ?? '');

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(
          children: [
            // Header
            const ClinicAppHeader(),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8EE)),

            // Content
            Expanded(
              child: _loading
                  ? const Center(
                      child: CircularProgressIndicator(
                        color: _primary,
                        strokeWidth: 2.5,
                      ),
                    )
                  : SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(
                        16 * scale,
                        18 * scale,
                        16 * scale,
                        110 * scale,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _TitleCard(scale: scale),
                          SizedBox(height: 16 * scale),
                          _FormCard(
                            scale: scale,
                            email: email,
                            role: role,
                            statusText: statusText,
                            statusColor: statusColor,
                            createdAt: createdAtFormatted,
                            fullName: fullName,
                            specialty: specialty,
                            licenseNo: _licenseNo,
                            contactPhone: _contactPhone,
                            signatureName: _signatureName.isNotEmpty
                                ? _signatureName
                                : (doctor?.name ?? ''),
                          ),
                          SizedBox(height: 16 * scale),
                          _SignaturePreviewCard(
                            scale: scale,
                            previewName: previewName,
                          ),
                          SizedBox(height: 14 * scale),
                          _InfoNote(scale: scale),
                          SizedBox(height: 14 * scale),
                          _SettingsCard(scale: scale),
                          SizedBox(height: 14 * scale),
                          _AccountDataCard(
                            scale: scale,
                            onOpenInfo: () => _openAccountDeletionInfo(context),
                            onRequestDelete: () =>
                                _confirmDeleteAccount(context, ref),
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
        selectedTab: ClinicBottomTab.profile,
      ),
    );
  }

  Future<void> _openAccountDeletionInfo(BuildContext context) async {
    final uri = Uri.parse(AppConfig.accountDeletionInfoUrl);
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bağlantı açılamadı')),
      );
    }
  }

  Future<void> _confirmDeleteAccount(
    BuildContext context,
    WidgetRef ref,
  ) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(
          'Hesabı sil',
          style: GoogleFonts.manrope(fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Hesabınız ve bu hesaba bağlı profil ile hasta / analiz verileri '
          'sunucudan kalıcı olarak silinecek. Bu işlem geri alınamaz.',
          style: GoogleFonts.inter(fontSize: 14, height: 1.45),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('İptal'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF93000A),
            ),
            child: const Text('Hesabı sil'),
          ),
        ],
      ),
    );
    if (confirm != true || !context.mounted) return;

    final err = await ref.read(authProvider.notifier).deleteAccount();
    if (!context.mounted) return;
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err)));
      return;
    }
    context.go('/signin');
  }
}

class _AccountDataCard extends StatelessWidget {
  const _AccountDataCard({
    required this.scale,
    required this.onOpenInfo,
    required this.onRequestDelete,
  });

  final double scale;
  final VoidCallback onOpenInfo;
  final VoidCallback onRequestDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14 * scale),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Column(
        children: [
          InkWell(
            borderRadius: BorderRadius.vertical(top: Radius.circular(14 * scale)),
            onTap: onOpenInfo,
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: 16 * scale,
                vertical: 14 * scale,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.policy_outlined,
                    size: 20,
                    color: const Color(0xFF00687A),
                  ),
                  SizedBox(width: 12 * scale),
                  Expanded(
                    child: Text(
                      'Hesap ve veri silme bilgisi (web)',
                      style: GoogleFonts.inter(
                        fontSize: 14 * scale,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.open_in_new_rounded,
                    size: 18,
                    color: Color(0xFF9CA3AF),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Color(0xFFF0F2F5)),
          InkWell(
            borderRadius: BorderRadius.vertical(
              bottom: Radius.circular(14 * scale),
            ),
            onTap: onRequestDelete,
            child: Padding(
              padding: EdgeInsets.symmetric(
                horizontal: 16 * scale,
                vertical: 14 * scale,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.delete_forever_outlined,
                    size: 20,
                    color: const Color(0xFF93000A),
                  ),
                  SizedBox(width: 12 * scale),
                  Expanded(
                    child: Text(
                      'Hesabımı ve verilerimi sil',
                      style: GoogleFonts.inter(
                        fontSize: 14 * scale,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF93000A),
                      ),
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: Colors.grey.shade400,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TitleCard extends StatelessWidget {
  const _TitleCard({required this.scale});
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(20 * scale),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16 * scale),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Profil Bilgileri',
            style: GoogleFonts.manrope(
              fontSize: 20 * scale,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF111827),
              letterSpacing: -0.3,
            ),
          ),
          SizedBox(height: 4 * scale),
          Text(
            'Doktor kimlik, uzmanlık ve imza bilgilerini yönetin.',
            style: GoogleFonts.inter(
              fontSize: 13 * scale,
              fontWeight: FontWeight.w400,
              color: const Color(0xFF5C6470),
            ),
          ),
        ],
      ),
    );
  }
}

class _FormCard extends StatelessWidget {
  const _FormCard({
    required this.scale,
    required this.email,
    required this.role,
    required this.statusText,
    required this.statusColor,
    required this.createdAt,
    required this.fullName,
    required this.specialty,
    required this.licenseNo,
    required this.contactPhone,
    required this.signatureName,
  });

  final double scale;
  final String email;
  final String role;
  final String statusText;
  final Color statusColor;
  final String createdAt;
  final String fullName;
  final String specialty;
  final String licenseNo;
  final String contactPhone;
  final String signatureName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(20 * scale),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16 * scale),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Kart başlığı
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(8 * scale),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2EDF8),
                  borderRadius: BorderRadius.circular(8 * scale),
                ),
                child: Icon(
                  Icons.person_outline_rounded,
                  size: 18 * scale,
                  color: const Color(0xFF4C7DA5),
                ),
              ),
              SizedBox(width: 12 * scale),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Doktor Profili',
                      style: GoogleFonts.manrope(
                        fontSize: 15 * scale,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF111827),
                      ),
                    ),
                    Text(
                      'Bu bilgiler rapor imzası ve klinik profilinde kullanılır.',
                      style: GoogleFonts.inter(
                        fontSize: 11 * scale,
                        fontWeight: FontWeight.w400,
                        color: const Color(0xFF5C6470),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 20 * scale),

          _FieldLabel('Hesap E-postası', scale: scale),
          SizedBox(height: 6 * scale),
          _ReadOnlyField(value: email, hint: 'ornek@klinik.com', scale: scale),
          SizedBox(height: 14 * scale),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FieldLabel('Rol', scale: scale),
                    SizedBox(height: 6 * scale),
                    _ReadOnlyField(value: role, hint: 'DOCTOR', scale: scale),
                  ],
                ),
              ),
              SizedBox(width: 12 * scale),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FieldLabel('Hesap Durumu', scale: scale),
                    SizedBox(height: 6 * scale),
                    _ReadOnlyField(
                      value: statusText,
                      hint: 'Aktif',
                      scale: scale,
                      valueColor: statusText == '-' ? null : statusColor,
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 14 * scale),

          _FieldLabel('Kayıt Tarihi', scale: scale),
          SizedBox(height: 6 * scale),
          _ReadOnlyField(
            value: createdAt,
            hint: 'gg.aa.yyyy ss:dd:ss',
            scale: scale,
          ),
          SizedBox(height: 14 * scale),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FieldLabel('Doktor Adı Soyadı', scale: scale),
                    SizedBox(height: 6 * scale),
                    _ReadOnlyField(
                      value: fullName,
                      hint: 'Ad Soyad',
                      scale: scale,
                    ),
                  ],
                ),
              ),
              SizedBox(width: 12 * scale),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FieldLabel('Uzmanlık', scale: scale),
                    SizedBox(height: 6 * scale),
                    _ReadOnlyField(
                      value: specialty,
                      hint: 'Göz Hastalıkları',
                      scale: scale,
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 14 * scale),

          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FieldLabel('Diploma / Sicil No', scale: scale),
                    SizedBox(height: 6 * scale),
                    _ReadOnlyField(
                      value: licenseNo,
                      hint: 'TR-123456',
                      scale: scale,
                    ),
                  ],
                ),
              ),
              SizedBox(width: 12 * scale),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _FieldLabel('İletişim Telefonu', scale: scale),
                    SizedBox(height: 6 * scale),
                    _ReadOnlyField(
                      value: contactPhone,
                      hint: '0 (5__) ___ __ __',
                      scale: scale,
                    ),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 14 * scale),

          _FieldLabel('İmzada Görünecek Ad', scale: scale),
          SizedBox(height: 6 * scale),
          _ReadOnlyField(value: signatureName, hint: 'Ad', scale: scale),
        ],
      ),
    );
  }
}

class _SignaturePreviewCard extends StatelessWidget {
  const _SignaturePreviewCard({required this.scale, required this.previewName});
  final double scale;
  final String previewName;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(20 * scale),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16 * scale),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'İmza Önizleme',
            style: GoogleFonts.manrope(
              fontSize: 14 * scale,
              fontWeight: FontWeight.w700,
              color: const Color(0xFF111827),
            ),
          ),
          SizedBox(height: 4 * scale),
          Text(
            'PDF raporunun imza alanında görünecek ad aşağıdaki gibidir.',
            style: GoogleFonts.inter(
              fontSize: 12 * scale,
              fontWeight: FontWeight.w400,
              color: const Color(0xFF00687A),
            ),
          ),
          SizedBox(height: 12 * scale),
          Container(
            width: double.infinity,
            padding: EdgeInsets.symmetric(
              horizontal: 14 * scale,
              vertical: 12 * scale,
            ),
            decoration: BoxDecoration(
              color: const Color(0xFFF5F7FA),
              borderRadius: BorderRadius.circular(8 * scale),
              border: Border.all(color: const Color(0xFFE2E8EE)),
            ),
            child: Text(
              previewName.isNotEmpty ? previewName : '-',
              style: GoogleFonts.inter(
                fontSize: 14 * scale,
                fontWeight: FontWeight.w500,
                color: const Color(0xFF111827),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoNote extends StatelessWidget {
  const _InfoNote({required this.scale});
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 14 * scale,
        vertical: 12 * scale,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F7FA),
        borderRadius: BorderRadius.circular(10 * scale),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.shield_outlined,
            size: 16 * scale,
            color: const Color(0xFF5C6470),
          ),
          SizedBox(width: 8 * scale),
          Expanded(
            child: Text(
              'Profil alanları bu ekranda yalnızca görüntülenebilir.',
              style: GoogleFonts.inter(
                fontSize: 12 * scale,
                fontWeight: FontWeight.w400,
                color: const Color(0xFF5C6470),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  const _SettingsCard({required this.scale});
  final double scale;

  static const List<_SettingItem> _items = [
    _SettingItem(Icons.settings_outlined, 'Ayarlar', '/settings'),
    _SettingItem(
      Icons.lock_outline_rounded,
      'Şifre Değiştir',
      '/reset-password',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14 * scale),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Column(
        children: [
          for (int i = 0; i < _items.length; i++) ...[
            if (i > 0)
              const Divider(height: 1, thickness: 1, color: Color(0xFFF0F2F5)),
            InkWell(
              borderRadius: i == 0
                  ? BorderRadius.vertical(top: Radius.circular(14 * scale))
                  : i == _items.length - 1
                  ? BorderRadius.vertical(bottom: Radius.circular(14 * scale))
                  : BorderRadius.zero,
              onTap: () => context.push(_items[i].route),
              child: Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: 16 * scale,
                  vertical: 14 * scale,
                ),
                child: Row(
                  children: [
                    Icon(
                      _items[i].icon,
                      size: 20,
                      color: const Color(0xFF00687A),
                    ),
                    SizedBox(width: 12 * scale),
                    Expanded(
                      child: Text(
                        _items[i].label,
                        style: GoogleFonts.inter(
                          fontSize: 14 * scale,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF1E293B),
                        ),
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 18,
                      color: Color(0xFF9CA3AF),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SettingItem {
  final IconData icon;
  final String label;
  final String route;
  const _SettingItem(this.icon, this.label, this.route);
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text, {required this.scale});
  final String text;
  final double scale;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.inter(
        fontSize: 12 * scale,
        fontWeight: FontWeight.w600,
        color: const Color(0xFF00687A),
      ),
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  const _ReadOnlyField({
    required this.value,
    required this.hint,
    required this.scale,
    this.valueColor,
  });

  final String value;
  final String hint;
  final double scale;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final isEmpty = value.isEmpty;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        horizontal: 14 * scale,
        vertical: 12 * scale,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F7FA),
        borderRadius: BorderRadius.circular(8 * scale),
        border: Border.all(color: const Color(0xFFE2E8EE)),
      ),
      child: Text(
        isEmpty ? hint : value,
        style: GoogleFonts.inter(
          fontSize: 13 * scale,
          fontWeight: FontWeight.w500,
          color: isEmpty
              ? const Color(0xFF9CA3AF)
              : (valueColor ?? const Color(0xFF111827)),
        ),
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

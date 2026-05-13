import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../widgets/clinic_app_header.dart';
import '../../data/models/patient_api_model.dart';
import '../../core/providers/patient_api_provider.dart';
import '../../core/utils/uuid_generator.dart';

class AddPatientScreen extends ConsumerStatefulWidget {
  const AddPatientScreen({super.key});

  @override
  ConsumerState<AddPatientScreen> createState() => _AddPatientScreenState();
}

class _AddPatientScreenState extends ConsumerState<AddPatientScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _tcController = TextEditingController();
  final _ageController = TextEditingController();
  final _hba1cController = TextEditingController();
  final _notesController = TextEditingController();

  String? _gender;
  final List<String> _genders = ['Erkek', 'Kadın', 'Belirtilmemiş'];

  // Tailwind colors
  static const Color background = Color(0xFFF7F9FB);
  static const Color primary = Color(0xFF00687A);
  static const Color primaryContainer = Color(0xFF06B6D4);
  static const Color surfaceContainerLowest = Color(0xFFFFFFFF);
  static const Color surfaceContainerLow = Color(0xFFF2F4F6);
  static const Color onSurface = Color(0xFF191C1E);
  static const Color onSurfaceVariant = Color(0xFF3D494C);
  static const Color outline = Color(0xFF6D797D);
  static const Color secondary = Color(0xFF565E74);

  void _savePatient() {
    if (!_formKey.currentState!.validate()) return;

    final name = _nameController.text.trim();
    final tc = _tcController.text.trim();
    final ageText = _ageController.text.trim();
    final age = int.tryParse(ageText) ?? 0;
    final hba1cText = _hba1cController.text.trim();
    final hba1c = double.tryParse(hba1cText);

    // Offline-first: UuidGenerator ile geçici ID, isSynced=false
    final newPatient = PatientApiModel(
      id: UuidGenerator.generateOfflineId(),
      fullName: name,
      tcNo: tc,
      age: age,
      gender: _gender,
      risk: 'Yok',
      hba1c: hba1c,
      createdAt: DateTime.now(),
      isSynced: false,
    );

    ref.read(patientApiProvider.notifier).addPatient(newPatient);

    if (mounted) {
      context.pop();
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _tcController.dispose();
    _ageController.dispose();
    _hba1cController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: background,
      body: SafeArea(
        child: Column(
          children: [
            const ClinicAppHeader(),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE2E8F0)),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24.0,
                  vertical: 16.0,
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ClinicPageTitleCard(
                        title: 'Yeni Hasta Kaydı',
                        subtitle:
                            'Hasta bilgilerini ve başlangıç metriklerini giriniz.',
                      ),
                      const SizedBox(height: 24),
                      _buildPersonalInfoSection(),
                      const SizedBox(height: 24),
                      _buildClinicalMetricsSection(),
                      const SizedBox(height: 24),
                      _buildAiHintCard(),
                      const SizedBox(height: 32),
                      _buildSaveButton(),
                      const SizedBox(height: 32),
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

  Widget _buildPersonalInfoSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF191C1E).withOpacity(0.04),
            offset: const Offset(0, 8),
            blurRadius: 30,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.person, color: primary, size: 20),
              ),
              const SizedBox(width: 12),
              Text(
                'Kişisel Bilgiler',
                style: GoogleFonts.manrope(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: secondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildTextFieldLabel('Ad Soyad'),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _nameController,
            hint: 'Örn: Ahmet Yılmaz',
            validator: (v) => v == null || v.trim().length < 3
                ? 'Geçerli bir ad soyad girin'
                : null,
          ),
          const SizedBox(height: 16),
          _buildTextFieldLabel('TC Kimlik No'),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _tcController,
            hint: '11 haneli kimlik numarası',
            keyboardType: TextInputType.number,
            maxLength: 11,
            validator: (v) {
              if (v == null || v.length != 11) {
                return '11 haneli T.C. kimlik numarası girin';
              }
              if (!RegExp(r'^[0-9]+$').hasMatch(v)) {
                return 'Sadece rakam girin';
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildTextFieldLabel('Yaş'),
                    const SizedBox(height: 8),
                    _buildTextField(
                      controller: _ageController,
                      hint: '0-120',
                      keyboardType: TextInputType.number,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildTextFieldLabel('Cinsiyet'),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _gender,
                      isExpanded: true,
                      icon: const Icon(
                        Icons.keyboard_arrow_down,
                        color: outline,
                      ),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: surfaceContainerLow,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 16,
                        ),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(
                            color: primary.withOpacity(0.2),
                            width: 2,
                          ),
                        ),
                      ),
                      style: GoogleFonts.inter(fontSize: 15, color: onSurface),
                      dropdownColor: surfaceContainerLowest,
                      hint: Text(
                        'Seçiniz',
                        style: GoogleFonts.inter(color: outline),
                      ),
                      items: _genders.map((String value) {
                        return DropdownMenuItem<String>(
                          value: value,
                          child: Text(value),
                        );
                      }).toList(),
                      onChanged: (newValue) {
                        setState(() {
                          _gender = newValue;
                        });
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildClinicalMetricsSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF191C1E).withOpacity(0.04),
            offset: const Offset(0, 8),
            blurRadius: 30,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.monitor_heart_outlined,
                  color: primary,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Text(
                'Klinik Metrikler',
                style: GoogleFonts.manrope(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: secondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: primaryContainer.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: primaryContainer.withOpacity(0.1)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'HbA1c Seviyesi',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: primary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Son 3 aylık kan şekeri ortalaması',
                          style: GoogleFonts.inter(
                            fontSize: 12,
                            color: onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: surfaceContainerLowest,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: primary.withOpacity(0.2)),
                      ),
                      child: Text(
                        '%',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _hba1cController,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  style: GoogleFonts.manrope(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: onSurface,
                  ),
                  decoration: InputDecoration(
                    hintText: 'Örn: 6.5',
                    hintStyle: GoogleFonts.manrope(
                      color: outline.withOpacity(0.5),
                    ),
                    filled: true,
                    fillColor: surfaceContainerLowest,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide.none,
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(
                        color: primary.withOpacity(0.2),
                        width: 2,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _buildTextFieldLabel('Ek Notlar / Diyabet Durumu'),
          const SizedBox(height: 8),
          _buildTextField(
            controller: _notesController,
            hint: 'Hasta öyküsü ve varsa diğer kronik rahatsızlıklar...',
            maxLines: 3,
          ),
        ],
      ),
    );
  }

  Widget _buildAiHintCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [primaryContainer.withOpacity(0.1), Colors.transparent],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: primaryContainer.withOpacity(0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: primaryContainer,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: primaryContainer.withOpacity(0.2),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(
              Icons.auto_awesome,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Yapay Zeka Destekli Kayıt',
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: primary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'HbA1c değerlerini girdiğinizde, Retina Klinik otomatik olarak diyabetik retinopati risk analizini başlatacaktır.',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: onSurfaceVariant,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSaveButton() {
    return Container(
      width: double.infinity,
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
            color: primary.withOpacity(0.25),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(28),
          onTap: _savePatient,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Kaydet',
                style: GoogleFonts.manrope(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.check_circle_outline,
                color: Colors.white,
                size: 24,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextFieldLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        text,
        style: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: onSurfaceVariant,
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
    int? maxLength,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLength: maxLength,
      maxLines: maxLines,
      validator: validator,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: GoogleFonts.inter(color: outline),
        filled: true,
        fillColor: surfaceContainerLow,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: primary.withOpacity(0.2), width: 2),
        ),
        counterText: '',
      ),
      style: GoogleFonts.inter(fontSize: 16, color: onSurface),
    );
  }
}

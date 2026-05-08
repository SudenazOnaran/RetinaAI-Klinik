import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../theme/app_theme.dart';
import '../widgets/index.dart';
import '../core/utils/permission_utils.dart';
import '../data/models/patient_api_model.dart';
import '../services/patient_service.dart';

class UploadScreen extends ConsumerStatefulWidget {
  const UploadScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<UploadScreen> createState() => _UploadScreenState();
}

class _UploadScreenState extends ConsumerState<UploadScreen> {
  final ImagePicker _imagePicker = ImagePicker();
  XFile? _selectedImage;
  bool _isAnalyzing = false;
  List<PatientApiModel> _patients = [];
  PatientApiModel? _selectedPatient;
  bool _loadingPatients = true;

  @override
  void initState() {
    super.initState();
    _loadPatients();
  }

  Future<void> _loadPatients() async {
    try {
      final patients = await PatientService.instance.getAll();
      if (mounted) {
        setState(() {
          _patients = patients;
          _loadingPatients = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loadingPatients = false);
    }
  }

  Future<void> _pickImageFromGallery() async {
    final ok = await PermissionUtils.requestGalleryPermission(context);
    if (!ok) return;
    final XFile? image =
        await _imagePicker.pickImage(source: ImageSource.gallery);
    if (image != null && mounted) setState(() => _selectedImage = image);
  }

  Future<void> _pickImageFromCamera() async {
    final ok = await PermissionUtils.requestCameraPermission(context);
    if (!ok) return;
    final XFile? image =
        await _imagePicker.pickImage(source: ImageSource.camera);
    if (image != null && mounted) setState(() => _selectedImage = image);
  }

  Future<void> _startAnalysis() async {
    if (_selectedImage == null) return;
    if (_selectedPatient == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Lütfen önce bir hasta seçin.')),
      );
      return;
    }

    setState(() => _isAnalyzing = true);

    if (mounted) {
      context.push('/loading', extra: {
        'imagePath': _selectedImage!.path,
        'patientId': _selectedPatient!.id,
      });
      setState(() => _isAnalyzing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Görüntü Yükle',
          style: GoogleFonts.manrope(fontSize: 20, fontWeight: FontWeight.w600),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Retinal Fundus Görüntüsü',
                  style: GoogleFonts.manrope(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onBackground,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'AI analizi için net bir fundus fotoğrafı yükleyin. Doğru tanı için görüntü kalitesi önemlidir.',
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                    color: AppColors.secondary,
                    height: 1.6,
                  ),
                ),
                const SizedBox(height: 24),

                // Hasta seçimi
                Text(
                  'Hasta Seçimi',
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.onBackground,
                  ),
                ),
                const SizedBox(height: 8),
                _loadingPatients
                    ? const LinearProgressIndicator()
                    : DropdownButtonFormField<PatientApiModel>(
                        value: _selectedPatient,
                        hint: const Text('Hasta seçin...'),
                        isExpanded: true,
                        decoration: InputDecoration(
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide:
                                const BorderSide(color: AppColors.outline),
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 12),
                        ),
                        items: _patients
                            .map((p) => DropdownMenuItem(
                                  value: p,
                                  child: Text(
                                    '${p.fullName} — ${p.tcNo}',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ))
                            .toList(),
                        onChanged: (p) =>
                            setState(() => _selectedPatient = p),
                      ),
                const SizedBox(height: 24),

                // Görüntü seçme alanı
                if (_selectedImage == null)
                  GestureDetector(
                    onTap: _pickImageFromGallery,
                    child: Container(
                      height: 220,
                      decoration: BoxDecoration(
                        color: AppColors.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: AppColors.outline,
                          width: 2,
                          style: BorderStyle.solid,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.cloud_upload_outlined,
                              size: 48, color: Color(0xFF06B6D4)),
                          const SizedBox(height: 12),
                          Text('Galeriden seçin',
                              style: GoogleFonts.manrope(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.onBackground)),
                          const SizedBox(height: 4),
                          Text('veya kamerayla çekin',
                              style: GoogleFonts.inter(
                                  fontSize: 13, color: AppColors.secondary)),
                        ],
                      ),
                    ),
                  )
                else
                  Column(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Image.file(
                          File(_selectedImage!.path),
                          height: 220,
                          width: double.infinity,
                          fit: BoxFit.cover,
                        ),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        height: 44,
                        child: OutlinedButton.icon(
                          onPressed: () =>
                              setState(() => _selectedImage = null),
                          icon: const Icon(Icons.close_rounded),
                          label: Text('Değiştir',
                              style: GoogleFonts.manrope(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600)),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(
                                color: AppColors.outline, width: 1.5),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(50)),
                          ),
                        ),
                      ),
                    ],
                  ),
                const SizedBox(height: 24),

                // Kalite kılavuzu
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F7FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Görüntü Kalitesi',
                          style: GoogleFonts.manrope(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppColors.primary)),
                      const SizedBox(height: 8),
                      _buildGuideline('Net ve odaklanmış'),
                      _buildGuideline('İyi aydınlatma, yüksek kontrast'),
                      _buildGuideline('Lens yansıması yok'),
                      _buildGuideline('Optik disk tamamen görünür'),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // Analiz butonu
                SizedBox(
                  width: double.infinity,
                  child: GradientButton(
                    label: _selectedImage != null
                        ? 'Analiz Et'
                        : 'Görüntü Seç',
                    onPressed: _selectedImage != null
                        ? _startAnalysis
                        : _pickImageFromGallery,
                    isLoading: _isAnalyzing,
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: OutlinedButton.icon(
                    onPressed: _pickImageFromCamera,
                    icon: const Icon(Icons.camera_alt_rounded),
                    label: Text('Fotoğraf Çek',
                        style: GoogleFonts.manrope(
                            fontSize: 16, fontWeight: FontWeight.w600)),
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(
                          color: AppColors.outline, width: 1.5),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(50)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGuideline(String text) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          const Icon(Icons.check_circle_rounded,
              size: 16, color: Color(0xFF00687a)),
          const SizedBox(width: 8),
          Text(text,
              style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppColors.onBackground)),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import '../theme/app_theme.dart';
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
    final XFile? image = await _imagePicker.pickImage(
      source: ImageSource.gallery,
    );
    if (image != null && mounted) setState(() => _selectedImage = image);
  }

  Future<void> _pickImageFromCamera() async {
    final ok = await PermissionUtils.requestCameraPermission(context);
    if (!ok) return;
    final XFile? image = await _imagePicker.pickImage(
      source: ImageSource.camera,
    );
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
      context.push(
        '/loading',
        extra: {
          'imagePath': _selectedImage!.path,
          'patientId': _selectedPatient!.id,
        },
      );
      setState(() => _isAnalyzing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const primary = Color(0xFF00687A);
    final screenWidth = MediaQuery.of(context).size.width;
    final scale = (screenWidth / 390).clamp(0.82, 1.0);

    return Scaffold(
      backgroundColor: const Color(0xFFF2F4F7),
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ──────────────────────────────────────────────
            Container(
              color: Colors.white,
              padding: EdgeInsets.fromLTRB(4, 4, 16, 4),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_rounded),
                    color: primary,
                    iconSize: 22,
                    onPressed: () {
                      if (context.canPop()) {
                        context.pop();
                      } else {
                        context.go('/home');
                      }
                    },
                  ),
                  SvgPicture.asset(
                    'retina-ai.svg',
                    width: 17 * scale,
                    height: 17 * scale,
                    colorFilter: const ColorFilter.mode(
                      primary,
                      BlendMode.srcIn,
                    ),
                  ),
                  SizedBox(width: 6 * scale),
                  Text(
                    'RETINA KLİNİK',
                    style: GoogleFonts.manrope(
                      fontSize: 15 * scale,
                      fontWeight: FontWeight.w700,
                      color: primary,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    width: 34 * scale,
                    height: 34 * scale,
                    clipBehavior: Clip.antiAlias,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: const Color(0x1F00687A),
                        width: 1,
                      ),
                    ),
                    child: const Icon(
                      Icons.person,
                      size: 17,
                      color: Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1, color: Color(0xFFE0E3E5)),

            // ── Scrollable body ──────────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  16 * scale,
                  16 * scale,
                  16 * scale,
                  32 * scale,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Info card ──────────────────────────────────
                    Container(
                      width: double.infinity,
                      padding: EdgeInsets.all(16 * scale),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8EE)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Fundus Analizi',
                            style: GoogleFonts.manrope(
                              fontSize: 20 * scale,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF111827),
                            ),
                          ),
                          SizedBox(height: 6 * scale),
                          Text(
                            'AI destekli fundus görüntüsü analizi ile diyabetik retinopati, glokom ve maküler dejenerasyon tespiti yapabilirsiniz.',
                            style: GoogleFonts.inter(
                              fontSize: 12.5 * scale,
                              color: const Color(0xFF475569),
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: 12 * scale),

                    // ── Patient selection card ─────────────────────
                    Container(
                      width: double.infinity,
                      padding: EdgeInsets.all(16 * scale),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8EE)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE8F4F8),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(
                                  Icons.person_search_rounded,
                                  color: primary,
                                  size: 18,
                                ),
                              ),
                              SizedBox(width: 10 * scale),
                              Text(
                                'Hasta Seçimi',
                                style: GoogleFonts.manrope(
                                  fontSize: 15 * scale,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF111827),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 12 * scale),
                          _loadingPatients
                              ? const LinearProgressIndicator()
                              : DropdownButtonFormField<PatientApiModel>(
                                  value: _selectedPatient,
                                  hint: Text(
                                    'Hasta seçin...',
                                    style: GoogleFonts.inter(
                                      fontSize: 13,
                                      color: const Color(0xFF94A3B8),
                                    ),
                                  ),
                                  isExpanded: true,
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: const Color(0xFFF8FAFC),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(
                                        color: Color(0xFFE2E8F0),
                                      ),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(
                                        color: Color(0xFFE2E8F0),
                                      ),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(
                                        color: primary,
                                        width: 1.5,
                                      ),
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 12,
                                    ),
                                  ),
                                  items: _patients
                                      .map(
                                        (p) => DropdownMenuItem(
                                          value: p,
                                          child: Text(
                                            '${p.fullName} — ${p.tcNo}',
                                            overflow: TextOverflow.ellipsis,
                                            style: GoogleFonts.inter(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w500,
                                            ),
                                          ),
                                        ),
                                      )
                                      .toList(),
                                  onChanged: (p) =>
                                      setState(() => _selectedPatient = p),
                                ),
                        ],
                      ),
                    ),
                    SizedBox(height: 12 * scale),

                    // ── Image upload card ─────────────────────────
                    Container(
                      width: double.infinity,
                      padding: EdgeInsets.all(16 * scale),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8EE)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFE8F4F8),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Icon(
                                  Icons.image_search_rounded,
                                  color: primary,
                                  size: 18,
                                ),
                              ),
                              SizedBox(width: 10 * scale),
                              Text(
                                'Fundus Görüntüsü',
                                style: GoogleFonts.manrope(
                                  fontSize: 15 * scale,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF111827),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 12 * scale),

                          if (_selectedImage == null)
                            GestureDetector(
                              onTap: _pickImageFromGallery,
                              child: Container(
                                height: 200 * scale,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF8FAFC),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: const Color(0xFFCBD5E1),
                                    width: 1.5,
                                    style: BorderStyle.solid,
                                  ),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.cloud_upload_outlined,
                                      size: 44 * scale,
                                      color: const Color(0xFF00687A),
                                    ),
                                    SizedBox(height: 10 * scale),
                                    Text(
                                      'Galeriden görüntü seçin',
                                      style: GoogleFonts.manrope(
                                        fontSize: 14 * scale,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFF111827),
                                      ),
                                    ),
                                    SizedBox(height: 4 * scale),
                                    Text(
                                      'veya aşağıdaki kamera butonunu kullanın',
                                      style: GoogleFonts.inter(
                                        fontSize: 11.5 * scale,
                                        color: const Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          else
                            Column(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(12),
                                  child: Image.file(
                                    File(_selectedImage!.path),
                                    height: 200 * scale,
                                    width: double.infinity,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                                SizedBox(height: 10 * scale),
                                SizedBox(
                                  width: double.infinity,
                                  child: OutlinedButton.icon(
                                    onPressed: () =>
                                        setState(() => _selectedImage = null),
                                    icon: const Icon(Icons.close_rounded),
                                    label: Text(
                                      'Görüntüyü Değiştir',
                                      style: GoogleFonts.manrope(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: const Color(0xFF475569),
                                      side: const BorderSide(
                                        color: Color(0xFFCBD5E1),
                                        width: 1.5,
                                      ),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      padding: const EdgeInsets.symmetric(
                                        vertical: 10,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),

                          SizedBox(height: 14 * scale),

                          // Quality guidelines
                          Container(
                            padding: EdgeInsets.all(12 * scale),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0F7FF),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Görüntü Kalite Gereksinimleri',
                                  style: GoogleFonts.manrope(
                                    fontSize: 12 * scale,
                                    fontWeight: FontWeight.w700,
                                    color: primary,
                                  ),
                                ),
                                SizedBox(height: 8 * scale),
                                _buildGuideline('Net ve odaklanmış', scale),
                                _buildGuideline(
                                  'İyi aydınlatma, yüksek kontrast',
                                  scale,
                                ),
                                _buildGuideline('Lens yansıması yok', scale),
                                _buildGuideline(
                                  'Optik disk tamamen görünür',
                                  scale,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: 20 * scale),

                    // ── Action buttons ────────────────────────────
                    SizedBox(
                      width: double.infinity,
                      height: 52 * scale,
                      child: ElevatedButton.icon(
                        onPressed: _isAnalyzing
                            ? null
                            : (_selectedImage != null
                                  ? _startAnalysis
                                  : _pickImageFromGallery),
                        icon: Icon(
                          _selectedImage != null
                              ? Icons.biotech_rounded
                              : Icons.add_photo_alternate_rounded,
                          size: 20,
                        ),
                        label: Text(
                          _selectedImage != null
                              ? (_isAnalyzing
                                    ? 'Analiz ediliyor...'
                                    : 'Analizi Başlat')
                              : 'Görüntü Seç',
                          style: GoogleFonts.manrope(
                            fontSize: 15 * scale,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: primary,
                          foregroundColor: Colors.white,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                    SizedBox(height: 10 * scale),
                    SizedBox(
                      width: double.infinity,
                      height: 52 * scale,
                      child: OutlinedButton.icon(
                        onPressed: _pickImageFromCamera,
                        icon: const Icon(Icons.camera_alt_rounded),
                        label: Text(
                          'Kamerayla Çek',
                          style: GoogleFonts.manrope(
                            fontSize: 15 * scale,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: primary,
                          side: const BorderSide(color: primary, width: 1.5),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuideline(String text, double scale) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            size: 16,
            color: Color(0xFF00687a),
          ),
          const SizedBox(width: 8),
          Text(
            text,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.onBackground,
            ),
          ),
        ],
      ),
    );
  }
}

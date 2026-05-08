import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../theme/app_theme.dart';
import '../core/network/api_client.dart';
import '../core/constants/api_constants.dart';
import '../data/models/analysis_api_model.dart';
import '../core/utils/uuid_generator.dart';
import '../services/analysis_service.dart';

class LoadingScreen extends ConsumerStatefulWidget {
  final Map<String, String>? uploadData;

  const LoadingScreen({Key? key, this.uploadData}) : super(key: key);

  @override
  ConsumerState<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends ConsumerState<LoadingScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;
  int _currentStep = 0;

  final List<String> _steps = [
    'Görüntü yükleniyor...',
    'AI modeli çalışıyor...',
    'Sonuçlar hazırlanıyor...',
  ];

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(begin: 0.8, end: 1.1).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeInOut),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) => _runAnalysis());
  }

  Future<void> _runAnalysis() async {
    final data = widget.uploadData;
    if (data == null) {
      if (mounted) context.go('/upload');
      return;
    }

    final imagePath = data['imagePath']!;
    final patientId = data['patientId']!;

    setState(() => _currentStep = 0);
    await Future.delayed(const Duration(milliseconds: 400));

    try {
      final formData = FormData.fromMap({
        'image': await MultipartFile.fromFile(
          imagePath,
          filename: 'fundus.jpg',
        ),
        'patientId': patientId,
      });

      setState(() => _currentStep = 1);

      final response = await ApiClient.instance.postAi(
        ApiConstants.aiPredict,
        data: formData,
      );

      setState(() => _currentStep = 2);
      await Future.delayed(const Duration(milliseconds: 300));

      if (!mounted) return;

      final body = response.data as Map<String, dynamic>;

      // 202 — kuyrukta
      if (response.statusCode == 202) {
        final queued = AnalysisApiModel(
          id: UuidGenerator.generateOfflineId(),
          patientId: patientId,
          aiResult: 'pending',
          confidence: 0.0,
          createdAt: DateTime.now(),
          isSynced: false,
        );
        await AnalysisService.instance.add(queued);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'AI servisi meşgul. Analiz sıraya alındı, sonuç yakında görüntülenecek.',
              ),
              duration: Duration(seconds: 4),
            ),
          );
          context.go('/home');
        }
        return;
      }

      // 200 — başarılı
      final pytorch = body['pytorch'] as Map<String, dynamic>?;
      final analysis = AnalysisApiModel(
        id: UuidGenerator.generateOfflineId(),
        patientId: patientId,
        aiResult:
            (pytorch?['label'] as String?) ??
            body['drGrade']?.toString() ??
            'unknown',
        confidence: ((pytorch?['confidence'] as num?) ?? 0.0).toDouble(),
        drGradeInt: (body['drGrade'] as num?)?.toInt(),
        heatmapUrl: body['heatmapUrl'] as String?,
        createdAt: DateTime.now(),
        isSynced: false,
      );

      await AnalysisService.instance.add(analysis);

      if (mounted) context.go('/results', extra: analysis);
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map
          ? (e.response!.data as Map)['error'] ?? 'Sunucu hatası'
          : 'Bağlantı hatası. Lütfen tekrar deneyin.';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('$msg'), backgroundColor: Colors.red),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Hata: $e'), backgroundColor: Colors.red),
      );
      context.pop();
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ScaleTransition(
                scale: _scaleAnimation,
                child: Container(
                  width: 140,
                  height: 140,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFF00687a).withOpacity(0.2),
                        const Color(0xFF06B6D4).withOpacity(0.1),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      RotationTransition(
                        turns: _animationController,
                        child: Container(
                          decoration: BoxDecoration(
                            border: Border.all(
                              color: const Color(0xFF06B6D4),
                              width: 3,
                            ),
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.remove_red_eye_outlined,
                        size: 48,
                        color: Color(0xFF00687a),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 40),
              Text(
                'AI Analizi Yapılıyor',
                style: GoogleFonts.manrope(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onBackground,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                _steps[_currentStep.clamp(0, _steps.length - 1)],
                style: GoogleFonts.inter(
                  fontSize: 15,
                  color: AppColors.secondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              const LinearProgressIndicator(),
              const SizedBox(height: 32),
              Text(
                'Retinal fundus görüntüsü analiz ediliyor.\nBu işlem birkaç saniye sürebilir.',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: AppColors.secondary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

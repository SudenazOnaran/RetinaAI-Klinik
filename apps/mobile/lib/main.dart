import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:retina_ai_app/router/router.dart';
import 'package:retina_ai_app/theme/app_theme.dart';
import 'package:retina_ai_app/core/network/api_client.dart';
import 'package:retina_ai_app/core/services/subscription_service.dart';
import 'package:retina_ai_app/data/local/database/app_database.dart';

Future<void> _initFirebaseIfAvailable() async {
  try {
    await Firebase.initializeApp();
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
  } catch (e, st) {
    if (kDebugMode) {
      debugPrint(
        'Firebase atlandı (android/app/google-services.json yok veya yapılandırma eksik): $e',
      );
      debugPrint('$st');
    }
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await _initFirebaseIfAvailable();

  // API client başlat
  ApiClient.instance.init();

  // RevenueCat başlat
  await SubscriptionService.instance.init();

  // SQLite veritabanını aç
  await AppDatabase.instance.db;

  runApp(const ProviderScope(child: RetinaAIApp()));
}

class RetinaAIApp extends StatelessWidget {
  const RetinaAIApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Retina AI',
      theme: AppTheme.lightTheme,
      routerConfig: appRouter,
      debugShowCheckedModeBanner: false,
    );
  }
}

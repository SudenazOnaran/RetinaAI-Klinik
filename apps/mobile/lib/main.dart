import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:retina_ai_app/router/router.dart';
import 'package:retina_ai_app/theme/app_theme.dart';
import 'package:retina_ai_app/core/network/api_client.dart';
import 'package:retina_ai_app/core/services/subscription_service.dart';
import 'package:retina_ai_app/data/local/database/app_database.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

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

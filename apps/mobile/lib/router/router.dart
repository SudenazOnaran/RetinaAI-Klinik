import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:retina_ai_app/screens/splash_screen.dart';
import 'package:retina_ai_app/screens/onboarding_1_screen.dart';
import 'package:retina_ai_app/screens/onboarding_2_screen.dart';
import 'package:retina_ai_app/screens/onboarding_3_screen.dart';
import 'package:retina_ai_app/screens/sign_in_screen.dart';
import 'package:retina_ai_app/screens/sign_up_screen.dart';
import 'package:retina_ai_app/screens/pending_approval_screen.dart';
import 'package:retina_ai_app/screens/reset_password_screen.dart';
import 'package:retina_ai_app/screens/pricing_screen.dart';
import 'package:retina_ai_app/screens/home_dashboard_screen.dart';
import 'package:retina_ai_app/screens/notifications_screen.dart';
import 'package:retina_ai_app/screens/recent_patients_screen.dart';
import 'package:retina_ai_app/screens/patients_screen.dart';
import 'package:retina_ai_app/screens/reports_screen.dart';
import 'package:retina_ai_app/screens/calendar_screen.dart';
import 'package:retina_ai_app/screens/settings_screen.dart';
import 'package:retina_ai_app/screens/profile_screen.dart';
import 'package:retina_ai_app/screens/upload_screen.dart';
import 'package:retina_ai_app/screens/loading_screen.dart';
import 'package:retina_ai_app/screens/results_screen.dart';
import 'package:retina_ai_app/screens/admin_panel_screen.dart';
import 'package:retina_ai_app/features/patients/add_patient_screen.dart';
import 'package:retina_ai_app/features/patients/patient_detail_screen.dart';
import 'package:retina_ai_app/data/models/patient_api_model.dart';
import 'package:retina_ai_app/data/models/analysis_api_model.dart';

final GoRouter appRouter = GoRouter(
  routes: [
    // Splash Screen (entry point)
    GoRoute(
      path: '/',
      name: 'splash',
      builder: (context, state) => const SplashScreen(),
    ),

    // Onboarding Screens
    GoRoute(
      path: '/onboarding1',
      name: 'onboarding1',
      builder: (context, state) => const Onboarding1Screen(),
    ),
    GoRoute(
      path: '/onboarding2',
      name: 'onboarding2',
      builder: (context, state) => const Onboarding2Screen(),
    ),
    GoRoute(
      path: '/onboarding3',
      name: 'onboarding3',
      builder: (context, state) => const Onboarding3Screen(),
    ),

    // Authentication Screens
    GoRoute(
      path: '/signin',
      name: 'signin',
      builder: (context, state) => const SignInScreen(),
    ),
    GoRoute(
      path: '/signup',
      name: 'signup',
      builder: (context, state) => const SignUpScreen(),
    ),

    // Pricing Screen
    GoRoute(
      path: '/pricing',
      name: 'pricing',
      builder: (context, state) => const PricingScreen(),
    ),

    // Dashboard Screens
    GoRoute(
      path: '/home',
      name: 'home',
      builder: (context, state) => const HomeDashboardScreen(),
    ),
    GoRoute(
      path: '/notifications',
      name: 'notifications',
      builder: (context, state) => const NotificationsScreen(),
    ),
    GoRoute(
      path: '/patients/recent',
      name: 'recent-patients',
      builder: (context, state) => const RecentPatientsScreen(),
    ),
    GoRoute(
      path: '/patients',
      name: 'patients',
      builder: (context, state) {
        final filter = state.uri.queryParameters['filter'];
        return PatientsScreen(initialFilter: filter);
      },
    ),
    GoRoute(
      path: '/patients/new',
      name: 'add-patient',
      builder: (context, state) => const AddPatientScreen(),
    ),
    GoRoute(
      path: '/patients/detail',
      name: 'patient-detail',
      builder: (context, state) {
        final extra = state.extra;
        if (extra is! PatientApiModel) {
          return const Scaffold(
            body: Center(child: Text('Hasta detayi bulunamadi.')),
          );
        }
        return PatientDetailScreen(patient: extra);
      },
    ),
    GoRoute(
      path: '/reports',
      name: 'reports',
      builder: (context, state) => const ReportsScreen(),
    ),
    GoRoute(
      path: '/calendar',
      name: 'calendar',
      builder: (context, state) => const CalendarScreen(),
    ),
    GoRoute(
      path: '/settings',
      name: 'settings',
      builder: (context, state) => const SettingsScreen(),
    ),
    GoRoute(
      path: '/profile',
      name: 'profile',
      builder: (context, state) => const ProfileScreen(),
    ),
    GoRoute(
      path: '/upload',
      name: 'upload',
      builder: (context, state) => const UploadScreen(),
    ),
    GoRoute(
      path: '/loading',
      name: 'loading',
      builder: (context, state) {
        final extra = state.extra as Map<String, String>?;
        return LoadingScreen(uploadData: extra);
      },
    ),
    GoRoute(
      path: '/results',
      name: 'results',
      builder: (context, state) {
        final extra = state.extra;
        if (extra is! AnalysisApiModel) {
          return const Scaffold(
            body: Center(child: Text('Analiz sonucu bulunamadı.')),
          );
        }
        return ResultsScreen(analysis: extra);
      },
    ),
    GoRoute(
      path: '/pending-approval',
      name: 'pending-approval',
      builder: (context, state) => const PendingApprovalScreen(),
    ),
    GoRoute(
      path: '/reset-password',
      name: 'reset-password',
      builder: (context, state) => const ResetPasswordScreen(),
    ),
    GoRoute(
      path: '/admin',
      name: 'admin',
      builder: (context, state) => const AdminPanelScreen(),
    ),
    GoRoute(
      path: '/analysis',
      name: 'analysis',
      builder: (context, state) => const UploadScreen(),
    ),
  ],
  initialLocation: '/',
  errorBuilder: (context, state) =>
      Scaffold(body: Center(child: Text('Page not found: ${state.uri}'))),
);

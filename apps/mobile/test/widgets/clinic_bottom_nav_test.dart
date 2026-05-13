import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:retina_ai_app/widgets/clinic_bottom_nav.dart';

void main() {
  Widget createTestApp(ClinicBottomTab initialTab) {
    final router = GoRouter(
      initialLocation: _getPathForTab(initialTab),
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, state) => Scaffold(
            body: const Text('Home Screen'),
            bottomNavigationBar: const ClinicBottomNav(
              selectedTab: ClinicBottomTab.panel,
            ),
          ),
        ),
        GoRoute(
          path: '/patients',
          builder: (context, state) => Scaffold(
            body: const Text('Patients Screen'),
            bottomNavigationBar: const ClinicBottomNav(
              selectedTab: ClinicBottomTab.patients,
            ),
          ),
        ),
        GoRoute(
          path: '/reports',
          builder: (context, state) => Scaffold(
            body: const Text('Reports Screen'),
            bottomNavigationBar: const ClinicBottomNav(
              selectedTab: ClinicBottomTab.reports,
            ),
          ),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => Scaffold(
            body: const Text('Settings Screen'),
            bottomNavigationBar: const ClinicBottomNav(
              selectedTab: ClinicBottomTab.profile,
            ),
          ),
        ),
      ],
    );

    return ProviderScope(child: MaterialApp.router(routerConfig: router));
  }

  group('ClinicBottomNav', () {
    testWidgets('renders all navigation items correctly', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(createTestApp(ClinicBottomTab.panel));
      await tester.pumpAndSettle();

      // Check if all labels are present
      expect(find.text('PANEL'), findsOneWidget);
      expect(find.text('HASTALAR'), findsOneWidget);
      expect(find.text('RAPORLAR'), findsOneWidget);
      expect(find.text('PROFİL'), findsOneWidget);

      // Check if icons are present
      expect(
        find.byIcon(Icons.dashboard_rounded),
        findsOneWidget,
      ); // Active icon for Panel
      expect(
        find.byIcon(Icons.group_outlined),
        findsOneWidget,
      ); // Inactive icon for Patients
      expect(
        find.byIcon(Icons.description_outlined),
        findsOneWidget,
      ); // Inactive icon for Reports
      expect(
        find.byIcon(Icons.person_outline_rounded),
        findsOneWidget,
      ); // Inactive icon for Profile
    });

    testWidgets('navigates to patients screen when HASTALAR is tapped', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(createTestApp(ClinicBottomTab.panel));
      await tester.pumpAndSettle();

      expect(find.text('Home Screen'), findsOneWidget);

      // Tap on HASTALAR
      await tester.tap(find.text('HASTALAR'));
      await tester.pumpAndSettle();

      // Verify navigation to Patients screen
      expect(find.text('Patients Screen'), findsOneWidget);
      // Active icon should now be group_rounded
      expect(find.byIcon(Icons.group_rounded), findsOneWidget);
    });

    testWidgets('navigates to reports screen when RAPORLAR is tapped', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(createTestApp(ClinicBottomTab.panel));
      await tester.pumpAndSettle();

      // Tap on RAPORLAR
      await tester.tap(find.text('RAPORLAR'));
      await tester.pumpAndSettle();

      // Verify navigation to Reports screen
      expect(find.text('Reports Screen'), findsOneWidget);
      expect(find.byIcon(Icons.description_rounded), findsOneWidget);
    });

    testWidgets('navigates to profile screen when PROFİL is tapped', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(createTestApp(ClinicBottomTab.panel));
      await tester.pumpAndSettle();

      // Tap on PROFİL
      await tester.tap(find.text('PROFİL'));
      await tester.pumpAndSettle();

      // Verify navigation to Profile screen
      expect(find.text('Settings Screen'), findsOneWidget);
      expect(find.byIcon(Icons.person_rounded), findsOneWidget);
    });

    testWidgets('does not navigate if already on the selected tab', (
      WidgetTester tester,
    ) async {
      await tester.pumpWidget(createTestApp(ClinicBottomTab.panel));
      await tester.pumpAndSettle();

      // Ensure we are on home screen
      expect(find.text('Home Screen'), findsOneWidget);

      // Tap on PANEL again
      await tester.tap(find.text('PANEL'));
      await tester.pumpAndSettle();

      // Should still be on home screen without issues
      expect(find.text('Home Screen'), findsOneWidget);
    });
  });
}

String _getPathForTab(ClinicBottomTab tab) {
  switch (tab) {
    case ClinicBottomTab.panel:
      return '/home';
    case ClinicBottomTab.patients:
      return '/patients';
    case ClinicBottomTab.reports:
      return '/reports';
    case ClinicBottomTab.profile:
      return '/profile';
    case ClinicBottomTab.admin:
      return '/admin';
  }
}

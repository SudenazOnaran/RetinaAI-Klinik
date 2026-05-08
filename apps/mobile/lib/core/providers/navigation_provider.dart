import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Global provider for the main bottom navigation tab index.
/// Used by [MainNavigationScreen] and [MainBottomNavBar] to keep
/// tab switching reactive without rebuilding the entire app.
final navigationIndexProvider = StateProvider<int>((ref) => 0);

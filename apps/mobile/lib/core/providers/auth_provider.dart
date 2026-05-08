import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/doctor_model.dart';
import '../../services/auth_service.dart';

/// Auth durumu
enum AuthStatus { loading, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final DoctorModel? doctor;
  final String? error;

  const AuthState({required this.status, this.doctor, this.error});

  const AuthState.loading() : this(status: AuthStatus.loading);
  const AuthState.authenticated(DoctorModel doctor)
    : this(status: AuthStatus.authenticated, doctor: doctor);
  const AuthState.unauthenticated({String? error})
    : this(status: AuthStatus.unauthenticated, error: error);
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>(
  (ref) => AuthNotifier(),
);

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState.loading()) {
    _checkAuth();
  }

  final _authService = AuthService.instance;

  /// Uygulama açılışında mevcut token'ı kontrol et.
  Future<void> _checkAuth() async {
    final loggedIn = await _authService.isLoggedIn();
    if (!loggedIn) {
      state = const AuthState.unauthenticated();
      return;
    }

    final doctor = await _authService.verifyToken();
    if (doctor != null) {
      state = AuthState.authenticated(doctor);
    } else {
      // Token geçersiz
      await _authService.logout();
      state = const AuthState.unauthenticated();
    }
  }

  Future<void> login(String email, String password) async {
    state = const AuthState.loading();
    try {
      final doctor = await _authService.login(email, password);
      state = AuthState.authenticated(doctor);
    } catch (e) {
      state = AuthState.unauthenticated(
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    state = const AuthState.unauthenticated();
  }
}

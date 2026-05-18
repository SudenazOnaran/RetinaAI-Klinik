import '../data/repositories/auth_repository.dart';
import '../data/models/doctor_model.dart';

/// Authentication işlemlerini sunar.
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  final _repo = AuthRepository.instance;

  Future<DoctorModel> login(String email, String password) =>
      _repo.login(email, password);

  Future<DoctorModel?> verifyToken() => _repo.verifyToken();

  Future<void> logout() => _repo.logout();

  Future<void> deleteAccount() => _repo.deleteAccount();

  Future<DoctorModel?> getCachedDoctor() => _repo.getCachedDoctor();

  Future<bool> isLoggedIn() => _repo.isLoggedIn();
}

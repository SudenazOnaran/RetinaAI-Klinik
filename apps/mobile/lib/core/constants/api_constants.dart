import '../config/app_config.dart';

/// API sabitlerini içerir. BaseUrl AppConfig üzerinden yönetilir.
class ApiConstants {
  ApiConstants._();

  static String get baseUrl => AppConfig.baseUrl;

  // --- Auth (mobile JWT endpoint'leri) ---
  static const String login = '/api/doctor/mobile/login';
  static const String verify = '/api/doctor/mobile/verify';
  static const String accountDelete = '/api/doctor/mobile/account';

  // --- Patients ---
  static const String patients = '/api/doctor/patients';
  static String patientById(String id) => '/api/doctor/patients/$id';

  // --- Analyses ---
  static const String analyses = '/api/doctor/analyses';
  static String analysisById(String id) => '/api/doctor/analyses/$id';

  // --- Sync ---
  static const String sync = '/api/doctor/sync';

  // --- Calendar (web endpoint, Bearer token) ---
  static const String calendar = '/api/doctor/calendar';

  // --- Doctor Profile & Settings ---
  static const String doctorProfile = '/api/doctor/profile';
  static const String doctorSettings = '/api/doctor/settings';

  // --- Public Registration & Password Reset ---
  static const String publicRegister = '/api/doctor/public-register';
  static const String resetTempPassword = '/api/doctor/password/reset-temp';

  // --- AI Predict ---
  static const String aiPredict = '/api/ai/predict';
  static const String aiPredictFfa = '/api/ai/predict-ffa';
  static const String aiPredictOct = '/api/ai/predict-oct';

  // --- Admin ---
  static const String adminRequests = '/api/admin/requests';
  static const String adminLandingContacts = '/api/admin/landing-contacts';
  static const int connectTimeout = 30;
  static const int receiveTimeout = 60;
  static const int aiReceiveTimeout = 120;

  // Secure Storage anahtarları
  static const String tokenKey = 'auth_token';
  static const String doctorIdKey = 'doctor_id';
  static const String doctorDataKey = 'doctor_data';
  static const String lastSyncKey = 'last_sync_date';
}

import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../../core/utils/connectivity_utils.dart';
import '../local/database/patient_dao.dart';
import '../local/database/analysis_dao.dart';
import '../local/secure_storage.dart';
import '../models/patient_api_model.dart';
import '../models/analysis_api_model.dart';

/// Senkronizasyon sonucu özeti.
class SyncResult {
  final int patientsSynced;
  final int analysesSynced;
  final int errors;
  final DateTime completedAt;

  const SyncResult({
    required this.patientsSynced,
    required this.analysesSynced,
    required this.errors,
    required this.completedAt,
  });
}

/// Offline kayıtları sunucuya senkronize eden repository.
class SyncRepository {
  SyncRepository._();
  static final SyncRepository instance = SyncRepository._();

  final _api = ApiClient.instance;
  final _patientDao = PatientDao.instance;
  final _analysisDao = AnalysisDao.instance;
  final _storage = SecureStorageService.instance;

  /// Tek seferde tüm offline kayıtları senkronize eder (batch sync).
  Future<SyncResult> sync() async {
    final connected = await ConnectivityUtils.isConnected();
    if (!connected) {
      throw Exception('İnternet bağlantısı yok');
    }

    int patientsSynced = 0;
    int analysesSynced = 0;
    int errors = 0;

    // VERITABANI-MIMARI.md: Önce hastalar, sonra analizler — tek batch isteği
    final unsyncedPatients = await _patientDao.getUnsynced();
    final unsyncedAnalyses = await _analysisDao.getUnsynced();

    if (unsyncedPatients.isNotEmpty || unsyncedAnalyses.isNotEmpty) {
      try {
        final counts = await _syncBatch(unsyncedPatients, unsyncedAnalyses);
        patientsSynced = counts['patients'] ?? 0;
        analysesSynced = counts['analyses'] ?? 0;
      } catch (_) {
        errors++;
      }
    }

    // 3. Son sync tarihini kaydet
    final now = DateTime.now();
    await _storage.saveLastSyncDate(now);

    return SyncResult(
      patientsSynced: patientsSynced,
      analysesSynced: analysesSynced,
      errors: errors,
      completedAt: now,
    );
  }

  /// VERITABANI-MIMARI.md: Tek batch isteği ile tüm offline kayıtları sync eder.
  /// POST /api/mobile/v1/sync
  /// Response: { patients: { mapping: { "offline_id": "server_id" } }, analyses: { mapping: {...} } }
  Future<Map<String, int>> _syncBatch(
    List<PatientApiModel> patients,
    List<AnalysisApiModel> analyses,
  ) async {
    final patientsPayload = patients.map((p) {
      final json = p.toJson();
      // Offline ID'yi ayrıca gönder; server ID mapping için
      json['offlineId'] = p.id;
      return json;
    }).toList();

    final analysesPayload = analyses.map((a) {
      final json = a.toJson();
      json['offlineId'] = a.id;
      return json;
    }).toList();

    final response = await _api.post(
      ApiConstants.sync,
      data: {
        if (patientsPayload.isNotEmpty) 'patients': patientsPayload,
        if (analysesPayload.isNotEmpty) 'analyses': analysesPayload,
      },
    );

    final data = response.data as Map<String, dynamic>;
    int patientsSynced = 0;
    int analysesSynced = 0;

    // Hasta ID mapping: { "offline_uuid": "server_id" }
    final patientMapping =
        (data['patients']?['mapping'] as Map<String, dynamic>?) ?? {};
    for (final entry in patientMapping.entries) {
      await _patientDao.updateId(entry.key, entry.value as String);
      patientsSynced++;
    }

    // Analiz ID mapping
    final analysisMapping =
        (data['analyses']?['mapping'] as Map<String, dynamic>?) ?? {};
    for (final entry in analysisMapping.entries) {
      await _analysisDao.updateId(entry.key, entry.value as String);
      analysesSynced++;
    }

    return {'patients': patientsSynced, 'analyses': analysesSynced};
  }

  /// Toplam senkronize edilmemiş kayıt sayısı.
  Future<int> totalUnsyncedCount() async {
    final patients = await _patientDao.unsyncedCount();
    final analyses = await _analysisDao.unsyncedCount();
    return patients + analyses;
  }

  Future<DateTime?> getLastSyncDate() => _storage.getLastSyncDate();
}

import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../../core/utils/connectivity_utils.dart';
import '../../core/utils/uuid_generator.dart';
import '../local/database/analysis_dao.dart';
import '../models/analysis_api_model.dart';

/// Offline-first analiz repository.
class AnalysisRepository {
  AnalysisRepository._();
  static final AnalysisRepository instance = AnalysisRepository._();

  final _api = ApiClient.instance;
  final _dao = AnalysisDao.instance;

  /// Bir hastanın analizlerini döner.
  Future<List<AnalysisApiModel>> getByPatientId(String patientId) async {
    final connected = await ConnectivityUtils.isConnected();
    if (connected && !UuidGenerator.isOfflineId(patientId)) {
      try {
        final response = await _api.get(
          ApiConstants.analyses,
          queryParameters: {'patientId': patientId},
        );
        final data = response.data as Map<String, dynamic>;
        final analyses = (data['analyses'] as List)
            .map((a) => AnalysisApiModel.fromJson(a as Map<String, dynamic>))
            .toList();
        await _dao.upsertAll(analyses);
        return analyses;
      } on DioException {
        // API hatası - yerel DB'ye düş
      }
    }
    return _dao.getByPatientId(patientId);
  }

  /// Tekil analiz getir (yerel DB'den).
  Future<AnalysisApiModel?> getById(String id) => _dao.getById(id);

  /// Yeni analiz ekle.
  Future<AnalysisApiModel> add(AnalysisApiModel analysis) async {
    final connected = await ConnectivityUtils.isConnected();

    if (!connected) {
      final offlineAnalysis = analysis.copyWith(
        id: UuidGenerator.generateOfflineId(),
        isSynced: false,
      );
      await _dao.upsert(offlineAnalysis);
      return offlineAnalysis;
    }

    final response = await _api.post(
      ApiConstants.analyses,
      data: analysis.toJson(),
    );
    final data = response.data as Map<String, dynamic>;
    final saved = AnalysisApiModel.fromJson(
      data['analysis'] as Map<String, dynamic>,
    );
    await _dao.upsert(saved);
    return saved;
  }

  /// Analiz güncelle (doktor notu vb.).
  Future<AnalysisApiModel> update(
    String id,
    Map<String, dynamic> fields,
  ) async {
    final connected = await ConnectivityUtils.isConnected();
    final existing = await _dao.getById(id);
    if (existing == null) throw Exception('Analiz bulunamadı: $id');

    if (!connected || UuidGenerator.isOfflineId(id)) {
      final updated = existing.applyFeedbackPatch(fields);
      await _dao.upsert(updated);
      return updated;
    }

    final response = await _api.patch(
      ApiConstants.analysisById(id),
      data: fields,
    );
    final data = response.data as Map<String, dynamic>;
    final saved = AnalysisApiModel.fromJson(
      data['analysis'] as Map<String, dynamic>,
    );
    await _dao.upsert(saved);
    return saved;
  }

  /// Analiz sil.
  Future<void> delete(String id) async {
    final connected = await ConnectivityUtils.isConnected();
    if (connected && !UuidGenerator.isOfflineId(id)) {
      await _api.delete(ApiConstants.analysisById(id));
    }
    await _dao.delete(id);
  }

  /// Senkronize edilmemiş analiz sayısı.
  Future<int> unsyncedCount() => _dao.unsyncedCount();

  Future<List<AnalysisApiModel>> getUnsynced() => _dao.getUnsynced();
}

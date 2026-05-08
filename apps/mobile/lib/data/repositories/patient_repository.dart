import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';
import '../../core/constants/api_constants.dart';
import '../../core/utils/connectivity_utils.dart';
import '../../core/utils/uuid_generator.dart';
import '../local/database/patient_dao.dart';
import '../models/patient_api_model.dart';

/// Offline-first hasta repository.
/// Önce yerel veritabanına yazar, bağlantı varsa API ile senkronize eder.
class PatientRepository {
  PatientRepository._();
  static final PatientRepository instance = PatientRepository._();

  final _api = ApiClient.instance;
  final _dao = PatientDao.instance;

  /// Hasta listesini döner.
  /// Bağlantı varsa API'den alır ve yerel DB'yi günceller.
  /// Bağlantı yoksa yerel DB'yi döner.
  Future<List<PatientApiModel>> getAll({DateTime? since}) async {
    final connected = await ConnectivityUtils.isConnected();
    if (connected) {
      try {
        final Map<String, dynamic>? queryParams = since != null
            ? {'since': since.toIso8601String()}
            : null;
        final response = await _api.get(
          ApiConstants.patients,
          queryParameters: queryParams,
        );
        final data = response.data as Map<String, dynamic>;
        final patients = (data['patients'] as List)
            .map((p) => PatientApiModel.fromJson(p as Map<String, dynamic>))
            .toList();
        await _dao.upsertAll(patients);
        return patients;
      } on DioException {
        // Bağlantı var ama API hatası - yerel DB'ye düş
      }
    }
    return _dao.getAll();
  }

  /// Tekil hasta getir (yerel DB'den).
  Future<PatientApiModel?> getById(String id) => _dao.getById(id);

  /// Yeni hasta ekle.
  /// Offline modda yerel DB'ye yazar; online modda doğrudan API'ye gönderir.
  Future<PatientApiModel> add(PatientApiModel patient) async {
    final connected = await ConnectivityUtils.isConnected();

    if (!connected) {
      final offlinePatient = patient.copyWith(
        id: UuidGenerator.generateOfflineId(),
        isSynced: false,
      );
      await _dao.upsert(offlinePatient);
      return offlinePatient;
    }

    final response = await _api.post(
      ApiConstants.patients,
      data: patient.toJson(),
    );
    final data = response.data as Map<String, dynamic>;
    final saved = PatientApiModel.fromJson(
      data['patient'] as Map<String, dynamic>,
    );
    await _dao.upsert(saved);
    return saved;
  }

  /// Hasta güncelle.
  Future<PatientApiModel> update(String id, Map<String, dynamic> fields) async {
    final connected = await ConnectivityUtils.isConnected();
    final existing = await _dao.getById(id);
    if (existing == null) throw Exception('Hasta bulunamadı: $id');

    if (!connected || UuidGenerator.isOfflineId(id)) {
      final updated = existing.copyWith(isSynced: false);
      await _dao.upsert(updated);
      return updated;
    }

    final response = await _api.patch(
      ApiConstants.patientById(id),
      data: fields,
    );
    final data = response.data as Map<String, dynamic>;
    final saved = PatientApiModel.fromJson(
      data['patient'] as Map<String, dynamic>,
    );
    await _dao.upsert(saved);
    return saved;
  }

  /// Hasta sil.
  Future<void> delete(String id) async {
    final connected = await ConnectivityUtils.isConnected();
    if (connected && !UuidGenerator.isOfflineId(id)) {
      await _api.delete(ApiConstants.patientById(id));
    }
    await _dao.delete(id);
  }

  /// Senkronize edilmemiş hasta sayısı.
  Future<int> unsyncedCount() => _dao.unsyncedCount();

  /// Sadece senkronize edilmemiş hastaları döner.
  Future<List<PatientApiModel>> getUnsynced() => _dao.getUnsynced();
}

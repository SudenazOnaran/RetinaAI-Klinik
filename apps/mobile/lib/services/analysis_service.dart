import '../data/repositories/analysis_repository.dart';
import '../data/models/analysis_api_model.dart';

/// Analiz işlemlerini UI katmanına sunar.
class AnalysisService {
  AnalysisService._();
  static final AnalysisService instance = AnalysisService._();

  final _repo = AnalysisRepository.instance;

  Future<List<AnalysisApiModel>> getByPatientId(String patientId) =>
      _repo.getByPatientId(patientId);

  Future<AnalysisApiModel?> getById(String id) => _repo.getById(id);

  Future<AnalysisApiModel> add(AnalysisApiModel analysis) =>
      _repo.add(analysis);

  Future<AnalysisApiModel> update(String id, Map<String, dynamic> fields) =>
      _repo.update(id, fields);

  Future<void> delete(String id) => _repo.delete(id);

  Future<int> unsyncedCount() => _repo.unsyncedCount();
}

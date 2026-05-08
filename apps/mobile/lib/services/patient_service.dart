import '../data/repositories/patient_repository.dart';
import '../data/models/patient_api_model.dart';

/// Hasta işlemlerini UI katmanına sunar.
class PatientService {
  PatientService._();
  static final PatientService instance = PatientService._();

  final _repo = PatientRepository.instance;

  Future<List<PatientApiModel>> getAll({DateTime? since}) =>
      _repo.getAll(since: since);

  Future<PatientApiModel?> getById(String id) => _repo.getById(id);

  Future<PatientApiModel> add(PatientApiModel patient) => _repo.add(patient);

  Future<PatientApiModel> update(String id, Map<String, dynamic> fields) =>
      _repo.update(id, fields);

  Future<void> delete(String id) => _repo.delete(id);

  Future<int> unsyncedCount() => _repo.unsyncedCount();
}

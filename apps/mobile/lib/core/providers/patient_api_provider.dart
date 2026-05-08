import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/patient_api_model.dart';
import '../../services/patient_service.dart';

/// Hasta listesi durumu
class PatientApiState {
  final List<PatientApiModel> patients;
  final bool isLoading;
  final String? error;

  const PatientApiState({
    this.patients = const [],
    this.isLoading = false,
    this.error,
  });

  PatientApiState copyWith({
    List<PatientApiModel>? patients,
    bool? isLoading,
    String? error,
  }) {
    return PatientApiState(
      patients: patients ?? this.patients,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

final patientApiProvider =
    StateNotifierProvider<PatientApiNotifier, PatientApiState>(
      (ref) => PatientApiNotifier(),
    );

class PatientApiNotifier extends StateNotifier<PatientApiState> {
  PatientApiNotifier() : super(const PatientApiState()) {
    loadPatients();
  }

  final _service = PatientService.instance;

  Future<void> loadPatients({DateTime? since}) async {
    state = state.copyWith(isLoading: true);
    try {
      final patients = await _service.getAll(since: since);
      state = state.copyWith(patients: patients, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<PatientApiModel> addPatient(PatientApiModel patient) async {
    final saved = await _service.add(patient);
    state = state.copyWith(patients: [saved, ...state.patients]);
    return saved;
  }

  Future<void> deletePatient(String id) async {
    await _service.delete(id);
    state = state.copyWith(
      patients: state.patients.where((p) => p.id != id).toList(),
    );
  }

  Future<PatientApiModel> updatePatient(
    String id,
    Map<String, dynamic> fields,
  ) async {
    final updated = await _service.update(id, fields);
    state = state.copyWith(
      patients: state.patients.map((p) => p.id == id ? updated : p).toList(),
    );
    return updated;
  }
}

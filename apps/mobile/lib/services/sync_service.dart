import '../data/repositories/sync_repository.dart';

export '../data/repositories/sync_repository.dart' show SyncResult;

/// Senkronizasyon işlemlerini UI katmanına sunar.
class SyncService {
  SyncService._();
  static final SyncService instance = SyncService._();

  final _repo = SyncRepository.instance;

  Future<SyncResult> sync() => _repo.sync();

  Future<int> totalUnsyncedCount() => _repo.totalUnsyncedCount();

  Future<DateTime?> getLastSyncDate() => _repo.getLastSyncDate();
}

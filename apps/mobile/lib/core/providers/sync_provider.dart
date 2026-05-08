import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../services/sync_service.dart';
import '../../data/repositories/sync_repository.dart';
import '../utils/connectivity_utils.dart';

class SyncState {
  final bool isSyncing;
  final int unsyncedCount;
  final DateTime? lastSyncDate;
  final String? error;
  final SyncResult? lastResult;

  const SyncState({
    this.isSyncing = false,
    this.unsyncedCount = 0,
    this.lastSyncDate,
    this.error,
    this.lastResult,
  });

  SyncState copyWith({
    bool? isSyncing,
    int? unsyncedCount,
    DateTime? lastSyncDate,
    String? error,
    SyncResult? lastResult,
  }) {
    return SyncState(
      isSyncing: isSyncing ?? this.isSyncing,
      unsyncedCount: unsyncedCount ?? this.unsyncedCount,
      lastSyncDate: lastSyncDate ?? this.lastSyncDate,
      error: error,
      lastResult: lastResult ?? this.lastResult,
    );
  }
}

final syncProvider = StateNotifierProvider<SyncNotifier, SyncState>(
  (ref) => SyncNotifier(),
);

class SyncNotifier extends StateNotifier<SyncState> {
  SyncNotifier() : super(const SyncState()) {
    _load();
  }

  final _service = SyncService.instance;

  Future<void> _load() async {
    final count = await _service.totalUnsyncedCount();
    final lastSync = await _service.getLastSyncDate();
    state = state.copyWith(unsyncedCount: count, lastSyncDate: lastSync);
  }

  /// Manuel senkronizasyon tetikler.
  Future<void> manualSync() async {
    if (state.isSyncing) return;

    final connected = await ConnectivityUtils.isConnected();
    if (!connected) {
      state = state.copyWith(error: 'İnternet bağlantısı yok');
      return;
    }

    state = state.copyWith(isSyncing: true, error: null);
    try {
      final result = await _service.sync();
      final count = await _service.totalUnsyncedCount();
      final lastSync = await _service.getLastSyncDate();
      state = state.copyWith(
        isSyncing: false,
        lastResult: result,
        unsyncedCount: count,
        lastSyncDate: lastSync,
      );
    } catch (e) {
      state = state.copyWith(
        isSyncing: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  /// Senkronize edilmemiş sayısını yenile.
  Future<void> refreshUnsyncedCount() async {
    final count = await _service.totalUnsyncedCount();
    state = state.copyWith(unsyncedCount: count);
  }
}

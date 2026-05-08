import 'package:sqflite/sqflite.dart';
import '../database/app_database.dart';
import '../../models/analysis_api_model.dart';

/// SQLite üzerinde analiz CRUD işlemleri.
class AnalysisDao {
  AnalysisDao._();
  static final AnalysisDao instance = AnalysisDao._();

  Future<Database> get _db => AppDatabase.instance.db;

  static const String _table = 'analyses';

  // Belirli bir hastanın analizlerini getir
  Future<List<AnalysisApiModel>> getByPatientId(String patientId) async {
    final db = await _db;
    final maps = await db.query(
      _table,
      where: 'patient_id = ?',
      whereArgs: [patientId],
      orderBy: 'created_at DESC',
    );
    return maps.map(AnalysisApiModel.fromMap).toList();
  }

  // ID'ye göre analiz getir
  Future<AnalysisApiModel?> getById(String id) async {
    final db = await _db;
    final maps = await db.query(_table, where: 'id = ?', whereArgs: [id]);
    if (maps.isEmpty) return null;
    return AnalysisApiModel.fromMap(maps.first);
  }

  // Senkronize edilmemiş analizleri getir
  Future<List<AnalysisApiModel>> getUnsynced() async {
    final db = await _db;
    final maps = await db.query(_table, where: 'is_synced = ?', whereArgs: [0]);
    return maps.map(AnalysisApiModel.fromMap).toList();
  }

  // Analiz ekle veya güncelle (upsert)
  Future<void> upsert(AnalysisApiModel analysis) async {
    final db = await _db;
    await db.insert(
      _table,
      analysis.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Toplu upsert
  Future<void> upsertAll(List<AnalysisApiModel> analyses) async {
    final db = await _db;
    final batch = db.batch();
    for (final a in analyses) {
      batch.insert(
        _table,
        a.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  // Offline ID'yi server ID ile güncelle
  Future<void> updateId(String offlineId, String serverId) async {
    final db = await _db;
    await db.update(
      _table,
      {'id': serverId, 'is_synced': 1},
      where: 'id = ?',
      whereArgs: [offlineId],
    );
  }

  // Analiz sil
  Future<void> delete(String id) async {
    final db = await _db;
    await db.delete(_table, where: 'id = ?', whereArgs: [id]);
  }

  // Senkronize edilmemiş kayıt sayısı
  Future<int> unsyncedCount() async {
    final db = await _db;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM $_table WHERE is_synced = 0',
    );
    return result.first['count'] as int;
  }
}

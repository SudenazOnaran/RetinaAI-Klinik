import 'package:sqflite/sqflite.dart';
import '../database/app_database.dart';
import '../../models/patient_api_model.dart';

/// SQLite üzerinde hasta CRUD işlemleri.
class PatientDao {
  PatientDao._();
  static final PatientDao instance = PatientDao._();

  Future<Database> get _db => AppDatabase.instance.db;

  static const String _table = 'patients';

  // Tüm hastaları getir
  Future<List<PatientApiModel>> getAll() async {
    final db = await _db;
    final maps = await db.query(_table, orderBy: 'created_at DESC');
    return maps.map(PatientApiModel.fromMap).toList();
  }

  // ID'ye göre hasta getir
  Future<PatientApiModel?> getById(String id) async {
    final db = await _db;
    final maps = await db.query(_table, where: 'id = ?', whereArgs: [id]);
    if (maps.isEmpty) return null;
    return PatientApiModel.fromMap(maps.first);
  }

  // Senkronize edilmemiş hastaları getir
  Future<List<PatientApiModel>> getUnsynced() async {
    final db = await _db;
    final maps = await db.query(_table, where: 'is_synced = ?', whereArgs: [0]);
    return maps.map(PatientApiModel.fromMap).toList();
  }

  // Hasta ekle veya güncelle (upsert)
  Future<void> upsert(PatientApiModel patient) async {
    final db = await _db;
    await db.insert(
      _table,
      patient.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  // Toplu upsert (sync sonrası)
  Future<void> upsertAll(List<PatientApiModel> patients) async {
    final db = await _db;
    final batch = db.batch();
    for (final p in patients) {
      batch.insert(
        _table,
        p.toMap(),
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  // Offline ID'yi server ID ile güncelle (sync sonrası)
  Future<void> updateId(String offlineId, String serverId) async {
    final db = await _db;
    await db.update(
      _table,
      {'id': serverId, 'is_synced': 1},
      where: 'id = ?',
      whereArgs: [offlineId],
    );
    // Analyses tablosundaki patient_id referanslarını da güncelle
    await db.update(
      'analyses',
      {'patient_id': serverId},
      where: 'patient_id = ?',
      whereArgs: [offlineId],
    );
  }

  // Hasta sil
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

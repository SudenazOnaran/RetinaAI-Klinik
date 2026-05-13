import 'package:sqflite/sqflite.dart';
import '../database/app_database.dart';
import '../../models/clinical_report_model.dart';

/// Klinik raporlar için SQLite CRUD işlemleri.
class ClinicalReportDao {
  ClinicalReportDao._();
  static final ClinicalReportDao instance = ClinicalReportDao._();

  Future<Database> get _db => AppDatabase.instance.db;

  static const String _table = 'clinical_reports';

  Future<void> insert(ClinicalReportModel report) async {
    final db = await _db;
    await db.insert(
      _table,
      report.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<ClinicalReportModel>> getByPatientId(String patientId) async {
    final db = await _db;
    final maps = await db.query(
      _table,
      where: 'patient_id = ?',
      whereArgs: [patientId],
      orderBy: 'created_at DESC',
    );
    return maps.map(ClinicalReportModel.fromMap).toList();
  }

  Future<void> deleteById(String id) async {
    final db = await _db;
    await db.delete(_table, where: 'id = ?', whereArgs: [id]);
  }

  Future<void> deleteAll() async {
    final db = await _db;
    await db.delete(_table);
  }
}

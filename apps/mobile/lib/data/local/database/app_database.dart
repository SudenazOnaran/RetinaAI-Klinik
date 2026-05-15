import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';

/// SQLite veritabanı başlatma ve migration yönetimi.
class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();

  static Database? _db;

  static const int _version = 6;
  static const String _dbName = 'retina_ai.db';

  Future<Database> get db async {
    _db ??= await _initDb();
    return _db!;
  }

  Future<Database> _initDb() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, _dbName);

    return openDatabase(
      path,
      version: _version,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute('''
      CREATE TABLE patients (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        tc_no TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT,
        risk TEXT NOT NULL,
        diabetes_years INTEGER,
        hba1c REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        is_synced INTEGER NOT NULL DEFAULT 0
      )
    ''');

    await db.execute('''
      CREATE TABLE analyses (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        ai_result TEXT NOT NULL,
        confidence REAL NOT NULL,
        heatmap_url TEXT,
        original_image TEXT,
        doctor_note TEXT,
        is_correct INTEGER,
        actual_result TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT,
        is_synced INTEGER NOT NULL DEFAULT 0,
        dr_grade_int INTEGER,
        dr_feedback TEXT,
        ilaclar TEXT,
        report_kind TEXT,
        ai_inference_json TEXT,
        oct_dr_feedback TEXT,
        ffa_dr_feedback TEXT,
        doctor_structured_review TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients (id)
      )
    ''');

    await db.execute('''
      CREATE TABLE clinical_reports (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        title TEXT NOT NULL,
        doctor_name TEXT,
        anamnesis TEXT,
        exam_findings TEXT,
        lab_results TEXT,
        diagnosis TEXT,
        treatment TEXT,
        doctor_notes TEXT,
        ai_notes TEXT,
        created_at TEXT NOT NULL
      )
    ''');

    // Sık kullanılan sorgular için index
    await db.execute(
      'CREATE INDEX idx_patients_is_synced ON patients (is_synced)',
    );
    await db.execute(
      'CREATE INDEX idx_analyses_patient_id ON analyses (patient_id)',
    );
    await db.execute(
      'CREATE INDEX idx_analyses_is_synced ON analyses (is_synced)',
    );
    await db.execute(
      'CREATE INDEX idx_clinical_reports_patient_id ON clinical_reports (patient_id)',
    );

    // Sync metadata (last sync time, config, vb.)
    await db.execute('''
      CREATE TABLE sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL
      )
    ''');
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      // v1 → v2: sync_metadata tablosu eklendi
      await db.execute('''
        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at TEXT NOT NULL
        )
      ''');
    }
    if (oldVersion < 3) {
      // v2 → v3: analyses tablosuna yeni sütunlar eklendi
      await db.execute('ALTER TABLE analyses ADD COLUMN dr_grade_int INTEGER');
      await db.execute('ALTER TABLE analyses ADD COLUMN dr_feedback TEXT');
      await db.execute('ALTER TABLE analyses ADD COLUMN ilaclar TEXT');
    }
    if (oldVersion < 4) {
      // v3 → v4: clinical_reports tablosu eklendi
      await db.execute('''
        CREATE TABLE IF NOT EXISTS clinical_reports (
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL,
          title TEXT NOT NULL,
          doctor_name TEXT,
          anamnesis TEXT,
          exam_findings TEXT,
          lab_results TEXT,
          diagnosis TEXT,
          treatment TEXT,
          doctor_notes TEXT,
          ai_notes TEXT,
          created_at TEXT NOT NULL
        )
      ''');
      await db.execute(
        'CREATE INDEX IF NOT EXISTS idx_clinical_reports_patient_id ON clinical_reports (patient_id)',
      );
    }
    if (oldVersion < 6) {
      await db.execute(
        'ALTER TABLE analyses ADD COLUMN oct_dr_feedback TEXT',
      );
      await db.execute(
        'ALTER TABLE analyses ADD COLUMN ffa_dr_feedback TEXT',
      );
      await db.execute(
        'ALTER TABLE analyses ADD COLUMN doctor_structured_review TEXT',
      );
    }
  }

  /// Sync metadata'ya değer yazar (key-value store).
  Future<void> setSyncMeta(String key, String value) async {
    final database = await db;
    await database.insert('sync_metadata', {
      'key': key,
      'value': value,
      'updated_at': DateTime.now().toIso8601String(),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  /// Sync metadata'dan değer okur.
  Future<String?> getSyncMeta(String key) async {
    final database = await db;
    final rows = await database.query(
      'sync_metadata',
      where: 'key = ?',
      whereArgs: [key],
    );
    if (rows.isEmpty) return null;
    return rows.first['value'] as String?;
  }

  /// Test veya logout sonrası tüm tabloları sıfırlar.
  Future<void> clearAll() async {
    final database = await db;
    await database.delete('analyses');
    await database.delete('patients');
    await database.delete('clinical_reports');
    await database.delete('sync_metadata');
  }

  Future<void> close() async {
    if (_db != null) {
      await _db!.close();
      _db = null;
    }
  }
}

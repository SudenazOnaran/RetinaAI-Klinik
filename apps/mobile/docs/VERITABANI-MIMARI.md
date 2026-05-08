# RetinaAI Klinik - Veritabanı Mimarisi

## 📊 Genel Bakış

RetinaAI Klinik projesi **iki farklı veritabanı** kullanır:

1. **PostgreSQL** - Sunucu (Backend)
2. **SQLite** - Mobil cihaz (Offline)

---

## 🏗️ Mimari Diyagram

```
┌─────────────────────────────────────────────────────────────┐
│                      SUNUCU (Cloud/Server)                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              PostgreSQL Database                      │  │
│  │  ┌──────────┐  ┌─────────┐  ┌──────────┐           │  │
│  │  │ Doctors  │  │ Patients│  │ Analyses │  ...      │  │
│  │  └──────────┘  └─────────┘  └──────────┘           │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ▲                                  │
│                           │                                  │
│  ┌────────────────────────┼──────────────────────────────┐ │
│  │    Next.js App         │                              │ │
│  │  ┌─────────────────────┴──────────────┐              │ │
│  │  │   Web UI         │    Mobile API   │              │ │
│  │  │  /dashboard      │  /api/mobile/v1 │              │ │
│  │  └─────────────────────┬──────────────┘              │ │
│  └────────────────────────┼──────────────────────────────┘ │
└────────────────────────────┼──────────────────────────────┘
                             │ HTTPS/API
                             │
                    ┌────────┴────────┐
                    │   İnternet      │
                    └────────┬────────┘
                             │
┌────────────────────────────┼──────────────────────────────┐
│              MOBİL CİHAZ (Telefon/Tablet)                 │
│                            │                               │
│  ┌─────────────────────────▼───────────────────────────┐ │
│  │         Flutter Mobile App                          │ │
│  │  ┌──────────────┐    ┌──────────────┐             │ │
│  │  │   UI Layer   │    │  Sync Layer  │             │ │
│  │  └──────┬───────┘    └──────┬───────┘             │ │
│  │         │                     │                     │ │
│  │         │    ┌────────────────┘                    │ │
│  │         │    │                                     │ │
│  │  ┌──────▼────▼──────────────────────────────┐    │ │
│  │  │     SQLite Database (Yerel)              │    │ │
│  │  │  ┌──────────┐  ┌─────────┐  ┌─────────┐ │    │ │
│  │  │  │ Patients │  │ Analyses│  │  Cache  │ │    │ │
│  │  │  │(isSynced)│  │(isSynced)│  │         │ │    │ │
│  │  │  └──────────┘  └─────────┘  └─────────┘ │    │ │
│  │  └──────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 🔄 Veri Akış Senaryoları

### Senaryo 1: Online Modda Hasta Ekleme

```
1. Doktor mobil uygulamada hasta ekler
   └─> Mobil App

2. İnternet var mı? ✅ Evet
   └─> API'ye POST isteği gönder

3. POST /api/mobile/v1/patients
   └─> Next.js API Handler

4. Prisma ile PostgreSQL'e yaz
   └─> PostgreSQL: INSERT INTO patients

5. Response: {id: "clud123abc", ...}
   └─> Mobil App

6. SQLite'a kaydet (cache için)
   └─> SQLite: INSERT (isSynced: true)

Sonuç: ✅ Hasta hem sunucuda hem mobilde
```

### Senaryo 2: Offline Modda Hasta Ekleme

```
1. Doktor mobil uygulamada hasta ekler
   └─> Mobil App

2. İnternet var mı? ❌ Hayır
   └─> Offline mode

3. Offline ID oluştur: "offline_uuid_123"
   └─> UUID Generator

4. SQLite'a kaydet
   └─> SQLite: INSERT (id: "offline_uuid_123", isSynced: false)

5. Kullanıcıya göster: "Offline kaydedildi, sync bekliyor"
   └─> UI Badge: 1 unsync

─────────────────────────────────────────────────

İnternet Geldi! 📶

6. Sync service başlat
   └─> SyncService.autoSync()

7. SQLite'dan unsync kayıtları al
   └─> SELECT * FROM patients WHERE is_synced = 0

8. Batch sync isteği gönder
   └─> POST /api/mobile/v1/sync
       Body: {
         patients: [{
           id: "offline_uuid_123",
           fullName: "Ali Veli",
           ...
         }]
       }

9. Server'da işle ve PostgreSQL'e yaz
   └─> PostgreSQL: INSERT INTO patients
       Yeni ID: "clud456def"

10. Response: ID mapping
    └─> {
          patients: {
            mapping: {
              "offline_uuid_123": "clud456def"
            }
          }
        }

11. SQLite güncelle
    └─> UPDATE patients 
        SET id = "clud456def", is_synced = 1
        WHERE id = "offline_uuid_123"

Sonuç: ✅ Offline kayıt sunucuya senkronize edildi
```

### Senaryo 3: Web'den Eklenen Hastayı Mobilde Görmek

```
1. Doktor web uygulamasından hasta ekler
   └─> Web App (Next.js)

2. PostgreSQL'e kaydet
   └─> PostgreSQL: INSERT INTO patients
       ID: "clue789xyz"

─────────────────────────────────────────────────

Mobil Uygulamada:

3. Periyodik sync (her 5 dakika veya manuel)
   └─> GET /api/mobile/v1/patients?since=<lastSyncTime>

4. API'den yeni hastaları al
   └─> Response: [{id: "clue789xyz", ...}]

5. SQLite'a ekle
   └─> SQLite: INSERT (id: "clue789xyz", isSynced: true)

6. UI güncelle
   └─> Hasta listesinde yeni hasta görünür

Sonuç: ✅ Web ve mobil senkronize
```

---

## 📊 Veritabanı Karşılaştırması

| Özellik | PostgreSQL (Sunucu) | SQLite (Mobil) |
|---------|---------------------|----------------|
| **Konum** | Cloud server | Mobil cihaz |
| **Kullanım** | Web + API | Offline cache |
| **Erişim** | Network | Local |
| **Boyut** | Sınırsız | Cihaz belleğine bağlı |
| **Concurrent** | Çok kullanıcı | Tek kullanıcı (doktor) |
| **Backup** | Server backup | Sync ile server'da |
| **Güvenlik** | Server security | Cihaz security |
| **Kalıcılık** | Kalıcı (production) | Geçici (cache/offline) |

---

## 🗄️ SQLite Şema (Mobil)

```sql
-- Patients table
CREATE TABLE patients (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    tc_no TEXT NOT NULL,
    age INTEGER NOT NULL,
    gender TEXT,
    risk TEXT,
    diabetes_years INTEGER,
    hba1c REAL,
    created_at TEXT NOT NULL,
    is_synced INTEGER DEFAULT 0  -- 0: unsync, 1: synced
);

-- Analyses table
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
    is_synced INTEGER DEFAULT 0,
    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
);

-- Sync metadata
CREATE TABLE sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
);
```

---

## 🔐 PostgreSQL Şema (Sunucu)

Backend'deki tam şema: [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma)

**Temel tablolar:**
- `Doctor` - Doktor bilgileri
- `Patient` - Hasta kayıtları
- `Analysis` - Retina analizleri
- `AuditLog` - İşlem logları
- `TrainingDatasetEntry` - AI eğitim verileri
- `DoctorSettings` - Doktor ayarları
- `CalendarEvent` - Takvim etkinlikleri

**İlişkiler:**
- `Doctor` (1) → (N) `Patient`
- `Patient` (1) → (N) `Analysis`
- `Analysis` (1) → (1) `TrainingDatasetEntry`

---

## 🔄 Senkronizasyon Stratejisi

### Otomatik Sync Tetikleyicileri

1. **İnternet bağlantısı geldiğinde**
   - Connectivity monitoring
   - Otomatik background sync

2. **Periyodik sync (5 dakikada bir)**
   - WorkManager (Android)
   - BackgroundTasks (iOS)

3. **Uygulama açılışında**
   - Splash screen'de sync

4. **Manuel sync**
   - Kullanıcı butona basınca

### Sync Önceliklendirme

```
1. Önce hastalar sync edilir
   └─> ID mapping alınır

2. Sonra analizler sync edilir
   └─> Hasta ID'leri mapping ile güncellenir

3. Hata varsa retry
   └─> Exponential backoff (1s, 2s, 4s, 8s...)
```

### Çakışma Yönetimi

**Last Write Wins (LWW)** stratejisi:
- En son güncelleme kazanır
- `updatedAt` timestamp'i karşılaştırılır
- Server timestamp her zaman source of truth

---

## 🛡️ Güvenlik Katmanları

### PostgreSQL (Sunucu)
- Row-level security (doktor sadece kendi hastalarını görür)
- JWT token ile authentication
- Prisma ORM (SQL injection koruması)
- HTTPS encryption

### SQLite (Mobil)
- Cihaz encryption (iOS: Data Protection, Android: Encrypted SharedPreferences)
- Token'lar Secure Storage'da
- Sensitive data loglanmaz
- Uygulama silince veri temizlenir

---

## 📈 Performans Optimizasyonu

### PostgreSQL
- Indexler (doctorId, patientId, createdAt)
- Connection pooling
- Query optimization (Prisma)

### SQLite
- Indexler (id, is_synced)
- Batch operations (tek transaction'da çoklu insert)
- Limit queries (pagination)
- Cleanup eski cache (30 gün+)

---

## 🔍 Debugging

### PostgreSQL Logları
```bash
# Production logs
kubectl logs -f deployment/web-app

# Database direct
psql $DATABASE_URL
SELECT * FROM "Patient" WHERE "doctorId" = 'clud123';
```

### SQLite Logları
```dart
// Flutter debug
final patients = await database.query('patients');
print('SQLite patients: ${patients.length}');

// Unsync count
final unsyncCount = await database.query(
  'patients',
  where: 'is_synced = ?',
  whereArgs: [0],
);
print('Unsync patients: ${unsyncCount.length}');
```

---

## 📚 İlgili Dokümantasyon

- [MOBILE-API-ENTEGRASYON.md](./MOBILE-API-ENTEGRASYON.md) - API detayları
- [MOBILE-APP-PROMPT-TEMPLATE.md](./MOBILE-APP-PROMPT-TEMPLATE.md) - Mobil geliştirme
- [apps/web/prisma/schema.prisma](../apps/web/prisma/schema.prisma) - PostgreSQL şema

---

## ❓ SSS

### "Neden iki farklı veritabanı?"
Offline-first mimari için. Mobil cihaz internet olmadan çalışmalı.

### "SQLite verileri kaybolur mu?"
Hayır. Sync edilince PostgreSQL'de kalıcı olur. SQLite sadece cache.

### "Web ve mobil aynı veriyi mi görür?"
Evet. PostgreSQL tek source of truth. Her iki uygulama da aynı DB'yi kullanır.

### "Çakışma olursa?"
Last Write Wins. En son güncelleme kazanır.

### "SQLite boyutu?"
Genelde 10-50 MB. Eski cache temizlenir (30 gün+).

---

**Son Güncelleme**: 28 Nisan 2026

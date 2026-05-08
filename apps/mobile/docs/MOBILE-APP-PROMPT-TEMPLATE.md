# AI Agent Prompt Template - RetinaAI Mobil Uygulama Geliştirme

Bu dosyayı AI agent'ınıza (GitHub Copilot, ChatGPT, Claude vb.) verirken kullanabilirsiniz.

---

## 🎯 Proje Genel Bakış

RetinaAI Klinik için bir mobil uygulama geliştiriyorum. Backend API'si hazır ve dokümante edilmiş durumda. Senin görevin bu API'yi kullanan, offline-first mimarisine sahip bir mobil uygulama geliştirmek.

### ⚠️ ÖNEMLİ: Veritabanı Mimarisi

**İki farklı veritabanı kullanıyoruz:**

1. **Sunucu (Backend)**: PostgreSQL
   - Web uygulaması ile aynı veritabanı
   - API endpoint'leri üzerinden erişim
   - `/api/mobile/v1/*` endpoint'leri PostgreSQL'e yazar

2. **Mobil Cihaz (Local)**: SQLite/Hive/Isar
   - Offline modda veri depolama
   - İnternet olmadan çalışma
   - Senkronizasyon: SQLite → API → PostgreSQL

**Veri Akışı:**
```
Kullanıcı Offline
└─> Mobil App → SQLite (local)

İnternet Geldi
└─> Mobil App → API Sync → PostgreSQL (server) → Web App ile paylaşılan DB
```

## 📚 Mevcut Dokümantasyon

Projeye eklediğim dokümantasyon dosyaları:

1. **MOBILE-API-ENTEGRASYON.md** - Detaylı API dokümantasyonu
   - API endpoint'leri ve kullanımı
   - Authentication flow
   - Offline-first stratejisi
   - Flutter kod örnekleri
   - Data modelleri
   - Sync mekanizması

2. **MOBILE-API-README.md** - Hızlı başlangıç kılavuzu
   - API test örnekleri
   - cURL komutları
   - Endpoint özeti

3. **types.ts** (Backend) - TypeScript tip tanımları
   - Request/Response modelleri
   - Dart ve Swift dönüşüm örnekleri

## 🎨 Uygulama Gereksinimleri

### Platform
- [ ] **Flutter** (tercih edilen) - iOS ve Android için tek codebase
- [ ] React Native (alternatif)
- [ ] Native Swift/Kotlin (alternatif)

### Temel Özellikler

1. **Kimlik Doğrulama**
   - Login ekranı
   - Token yönetimi (Secure Storage)
   - Otomatik logout (token expiry)
   - Remember me özelliği

2. **Offline-First Veri Yönetimi**
   - **Yerel cihaz veritabanı**: SQLite/Hive/Isar (offline depolama)
   - **Sunucu veritabanı**: PostgreSQL (web ile aynı DB - API üzerinden erişim)
   - Offline modda hasta ekleme (yerel SQLite'a)
   - Offline modda analiz yapma (yerel SQLite'a)
   - Otomatik/manuel senkronizasyon (SQLite → API → PostgreSQL)
   - Sync durumu göstergesi

3. **Hasta Yönetimi**
   - Hasta listesi (arama, filtreleme)
   - Hasta ekleme formu
   - Hasta detay sayfası
   - Hasta düzenleme
   - Hasta silme (onay ile)

4. **Analiz Yönetimi**
   - Hasta için analiz listesi
   - Yeni analiz ekleme
   - Kamera ile retina görüntüsü çekme
   - Galeriden görüntü seçme
   - AI sonuç gösterimi
   - Doktor notu ekleme

5. **Senkronizasyon**
   - Background sync (WorkManager/BackgroundTask)
   - Manuel sync butonu
   - Sync progress göstergesi
   - Offline kayıt sayısı badge
   - Çakışma yönetimi

## 🏗️ Proje Yapısı (Flutter Örneği)

Lütfen şu klasör yapısını kullan:

```
lib/
├── main.dart
├── app.dart
├── core/
│   ├── constants/
│   │   └── api_constants.dart          # API URLs, endpoints
│   ├── network/
│   │   ├── api_client.dart             # HTTP client wrapper
│   │   └── api_interceptor.dart        # Token injection
│   └── utils/
│       ├── connectivity_utils.dart     # İnternet kontrolü
│       └── uuid_generator.dart         # Offline ID generator
├── data/
│   ├── models/
│   │   ├── patient.dart
│   │   ├── analysis.dart
│   │   └── doctor.dart
│   ├── local/
│   │   ├── database/
│   │   │   ├── app_database.dart       # SQLite/Hive init
│   │   │   ├── patient_dao.dart
│   │   │   └── analysis_dao.dart
│   │   └── secure_storage.dart         # Token storage
│   └── repositories/
│       ├── auth_repository.dart
│       ├── patient_repository.dart
│       ├── analysis_repository.dart
│       └── sync_repository.dart
├── services/
│   ├── auth_service.dart
│   ├── patient_service.dart
│   ├── analysis_service.dart
│   └── sync_service.dart
├── presentation/
│   ├── screens/
│   │   ├── splash_screen.dart
│   │   ├── login_screen.dart
│   │   ├── home_screen.dart
│   │   ├── patients/
│   │   │   ├── patients_list_screen.dart
│   │   │   ├── patient_detail_screen.dart
│   │   │   └── add_patient_screen.dart
│   │   ├── analyses/
│   │   │   ├── analysis_list_screen.dart
│   │   │   ├── add_analysis_screen.dart
│   │   │   └── analysis_detail_screen.dart
│   │   └── settings/
│   │       └── settings_screen.dart
│   ├── widgets/
│   │   ├── patient_card.dart
│   │   ├── analysis_card.dart
│   │   ├── sync_indicator.dart
│   │   └── offline_badge.dart
│   └── providers/
│       ├── auth_provider.dart
│       ├── patient_provider.dart
│       ├── analysis_provider.dart
│       └── sync_provider.dart
└── routes/
    └── app_routes.dart
```

## 📝 Adım Adım Geliştirme Planı

### Faz 1: Temel Altyapı
1. ✅ Flutter projesi oluştur ve dependencies ekle
2. ✅ Klasör yapısını kur
3. ✅ API constants tanımla (Backend: PostgreSQL via API)
4. ✅ HTTP client ve interceptor kur (API endpoint'leri için)
5. ✅ Secure Storage implementation (token depolama)
6. ✅ Yerel cihaz veritabanı (SQLite/Hive) kur (offline depolama)

### Faz 2: Data Layer
1. ✅ Data model'lerini oluştur (Patient, Analysis, Doctor)
   - JSON serialization
   - toJson() / fromJson() metodları
2. ✅ DAO'ları (Data Access Objects) implement et
3. ✅ Repository pattern ile data layer oluştur
4. ✅ Offline ID generation mekanizması

### Faz 3: Authentication
1. ✅ Login screen UI
2. ✅ Auth service implementation
3. ✅ Token management
4. ✅ Auto-logout on token expiry
5. ✅ Splash screen ve route guard

### Faz 4: Hasta Yönetimi
1. ✅ Hasta listesi ekranı
2. ✅ Hasta ekleme formu
3. ✅ Hasta detay ekranı
4. ✅ Hasta düzenleme
5. ✅ Offline hasta ekleme support

### Faz 5: Analiz Yönetimi
1. ✅ Analiz listesi
2. ✅ Kamera entegrasyonu
3. ✅ Görüntü upload
4. ✅ AI sonuç gösterimi
5. ✅ Doktor notu ekleme

### Faz 6: Senkronizasyon
1. ✅ Connectivity monitoring
2. ✅ Otomatik sync service
3. ✅ Manuel sync butonu
4. ✅ Background sync (WorkManager)
5. ✅ Sync progress UI
6. ✅ Conflict resolution
 (Mobil cihazda offline depolama için)
  sqflite: ^2.3.0
  # veya: hive: ^2.2.3
  # veya: isar: ^3.1.0
  # NOT: Sunucu veritabanı PostgreSQL - API üzerinden erişilir
3. ✅ Empty states
4. ✅ Unit tests
5. ✅ Integration tests

## 🔧 Gerekli Dependencies (Flutter)

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  provider: ^6.1.1
  # veya: riverpod, bloc, get
  
  # Network
  http: ^1.1.0
  dio: ^5.4.0  # Alternatif, interceptor için daha iyi
  
  # Local Database
  sqflite: ^2.3.0
  # veya: hive: ^2.2.3
  # veya: isar: ^3.1.0
  
  # Secure Storage
  flutter_secure_storage: ^9.0.0
  
  # Utils
  uuid: ^4.1.0
  connectivity_plus: ^5.0.2
  path: ^1.8.3
  
  # Image
  image_picker: ^1.0.5
  camera: ^0.10.5
  
  # Background Tasks
  workmanager: ^0.5.1
  
  # UI
  cached_network_image: ^3.3.0
  shimmer: ^3.0.0
  
dev_dependencies:
  flutter_test:
    sdk: flutter
  mockito: ^5.4.4
  integration_test:
    sdk: flutter
```

## 💻 Kod Yazma Talimatları

### 1. API Client Implementation

**MOBILE-API-ENTEGRASYON.md** dosyasındaki `ApiService` Flutter örneğini baz alarak detaylı bir implementation yap:

```dart
// lib/core/network/api_client.dart
class ApiClient {
  static const String baseUrl = 'https://your-domain.com';
  
  Future<Map<String, String>> _getHeaders() async {
    // Token'ı SecureStorage'dan al
    // Authorization header ekle
  }
  
  Future<http.Response> get(String endpoint) async {
    // GET request implementation
  }
  
  Future<http.Response> post(String endpoint, Map<String, dynamic> body) async {
    // POST request implementation
  }
  
  // ... PATCH, DELETE
}
```

### 2. Offline ID Stratejisi

**MOBILE-API-ENTEGRASYON.md** dosyasındaki "Offline ID Stratejisi" bölümünü takip et:

```dart
String generateOfflineId() {
  return 'offline_${Uuid().v4()}';
}

bool isOfflineId(String id) {
  return id.startsWith('offline_');
}
```

### 3. Data Models

**types.ts** dosyasındaki TypeScript tanımlarını Dart'a çevir. Her model için:

```dart
class Patient {
  final String id;
  final String fullName;
  final String tcNo;
  final int age;
  final String? gender;
  final String risk;
  final int? diabetesYears;
  final double? hba1c;
  final DateTime createdAt;
  final bool isSynced; // Yerel kullanım için
  
  Patient({
    required this.id,
    required this.fullName,
    required this.tcNo,
    required this.age,
    this.gender,
    required this.risk,
    this.diabetesYears,
    this.hba1c,
    required this.createdAt,
    this.isSynced = false,
  });
  
  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: json['id'],
      fullName: json['fullName'],
      tcNo: json['tcNo'],
      age: json['age'],
      gender: json['gender'],
      risk: json['risk'],
      diabetesYears: json['diabetesYears'],
      hba1c: json['hba1c']?.toDouble(),
      createdAt: DateTime.parse(json['createdAt']),
      isSynced: json['isSynced'] ?? false,
    );
  }
  
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'fullName': fullName,
      'tcNo': tcNo,
      'age': age,
      'gender': gender,
      'risk': risk,
      'diabetesYears': diabetesYears,
      'hba1c': hba1c,
      'createdAt': createdAt.toIso8601String(),
      'isSynced': isSynced,
    };
  }
  
  // Local DB için toMap
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'full_name': fullName,
      'tc_no': tcNo,
      'age': age,
      'gender': gender,
      'risk': risk,
      'diabetes_years': diabetesYears,
      'hba1c': hba1c,
      'created_at': createdAt.toIso8601String(),
      'is_synced': isSynced ? 1 : 0,
    };
  }
  
  factory Patient.fromMap(Map<String, dynamic> map) {
    return Patient(
      id: map['id'],
      fullName: map['full_name'],
      tcNo: map['tc_no'],
      age: map['age'],
      gender: map['gender'],
      risk: map['risk'],
      diabetesYears: map['diabetes_years'],
      hba1c: map['hba1c']?.toDouble(),
      createdAt: DateTime.parse(map['created_at']),
      isSynced: map['is_synced'] == 1,
    );
  }
}
```

### 4. Sync Service

**MOBILE-API-ENTEGRASYON.md** dosyasındaki "Sync Service" bölümünü tam olarak implement et:

```dart
// lib/services/sync_service.dart
class SyncService {
  final ApiClient _apiClient;
  final LocalDatabase _localDB;
  final Connectivity _connectivity;
  
  Future<bool> isConnected() async {
    // Bağlantı kontrolü
  }
  
  Future<void> autoSync() async {
    // Otomatik senkronizasyon
    // MOBILE-API-ENTEGRASYON.md'deki örneği takip et
  }
  
  Future<Map<String, dynamic>> manualSync() async {
    // Manuel senkronizasyon
    // UI'da progress göster
  }
}
```

### 5. UI Best Practices

- Material Design 3 kullan
- Loading states ekle (shimmer, spinner)
- Empty states tasarla
- Error handling ile user-friendly mesajlar
- Pull-to-refresh ekle
- Offline indicator badge ekle
- Form validation yap

### 6. Security Best Practices

- Token'ları **flutter_secure_storage** ile sakla
- API calls için **HTTPS** kullan
- Sensitive data'yı loglamayın
- Image upload için base64 veya multipart kullan

## 🎯 İstediğim Çıktı

Her adımda:
1. ✅ **Çalışan, test edilmiş kod** yaz
2. ✅ **Kod yorumlarıyla açıkla** (Türkçe veya İngilizce)
3. ✅ **Error handling** ekle
4. ✅ **Loading states** ekle
5. ✅ **MOBILE-API-ENTEGRASYON.md** ile uyumlu ol
6. ✅ **Clean code** ve **SOLID principles** kullan

## 📌 API Endpoint Referansı

### Auth
- `POST /api/mobile/v1/auth/login` - Login
- `POST /api/mobile/v1/auth/verify` - Token verify

### Patients
- `GET /api/mobile/v1/patients` - Liste
- `POST /api/mobile/v1/patients` - Ekle/Batch
- `GET /api/mobile/v1/patients/{id}` - Detay
- `PATCH /api/mobile/v1/patients/{id}` - Güncelle
- `DELETE /api/mobile/v1/patients/{id}` - Sil

### Analyses
- `GET /api/mobile/v1/analyses` - Liste
- `POST /api/mobile/v1/analyses` - Ekle/Batch
- `GET /api/mobile/v1/analyses/{id}` - Detay
- `PATCH /api/mobile/v1/analyses/{id}` - Güncelle
- `DELETE /api/mobile/v1/analyses/{id}` - Sil

### Sync
- `POST /api/mobile/v1/sync` - Toplu sync
- `GET /api/mobile/v1/sync` - Sync durumu

## 🚀 Hemen Başla

**Şimdi ne yapmamı istersin?**

Seçenekler:
1. "Faz 1'den başla - Temel altyapıyı kur"
2. "Data model'lerini oluştur"
3. "Login ekranını yap"
4. "Sync service'i implement et"
5. "Tüm projeyi baştan sona yap" (uzun sürer, adım adım ilerleriz)

**Not:** Her adımda **MOBILE-API-ENTEGRASYON.md** dosyasına referans ver ve API endpoint'lerini doğru kullan!

---

## 📞 Yardım

Tıkanırsan:
- **MOBILE-API-ENTEGRASYON.md** - Detaylı referans
- **MOBILE-API-README.md** - Hızlı başlangıç
- Backend API test: `http://localhost:9002/api/mobile/v1`

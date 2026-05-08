# Mobil Uygulama Geliştirme - Hızlı Prompt Örnekleri

Bu dosya farklı senaryolar için hazır prompt örnekleri içerir. Duruma göre seçip AI agent'ınıza verebilirsiniz.

---

## 🚀 Senaryo 1: Tüm Projeyi Sıfırdan Başlat

```
RetinaAI Klinik için Flutter mobil uygulaması geliştiriyorum.

MEVCUT DOSYALAR:
- MOBILE-API-ENTEGRASYON.md (API dokümantasyonu)
- MOBILE-API-README.md (Hızlı başlangıç)
- MOBILE-APP-PROMPT-TEMPLATE.md (Detaylı gereksinimler)

GÖREV:
1. Flutter projesi kur (dependencies: provider, http, sqflite, flutter_secure_storage, uuid, connectivity_plus)
2. MOBILE-APP-PROMPT-TEMPLATE.md'deki klasör yapısını oluştur
3. MOBILE-API-ENTEGRASYON.md'deki API endpoint'lerini kullanarak:
   - Login flow
   - Offline-first hasta yönetimi
   - Offline-first analiz yönetimi
   - Otomatik senkronizasyon
4. Material Design 3 ile temiz UI

OFFLINE-FIRST ÖNEMLİ:
- Mobil cihazda SQLite (yerel depolama)
- Sunucuda PostgreSQL (web ile aynı DB - API üzerinden)
- Offline modda hasta eklenebilmeli (SQLite'a, offline_<uuid> ID)
- İnternet geldiğinde otomatik sync (SQLite → API → PostgreSQL)

API BASE URL: https://your-domain.com/api/mobile/v1

Adım adım ilerleyelim. İlk adım: Flutter projesi ve dependencies.
```

---

## 🔐 Senaryo 2: Sadece Authentication Modülü

```
Flutter projemde authentication modülünü oluştur.

DOKÜMANTASYON: MOBILE-API-ENTEGRASYON.md

ENDPOINT'LER:
- POST /api/mobile/v1/auth/login
- POST /api/mobile/v1/auth/verify

GEREKSİNİMLER:
1. Login screen (email, password)
2. Token'ı flutter_secure_storage ile sakla
3. HTTP interceptor ile her istekte token ekle
4. Token expiry kontrolü
5. Auto-logout özelliği
6. Remember me checkbox

DOSYALAR:
- lib/data/models/doctor.dart
- lib/services/auth_service.dart
- lib/data/repositories/auth_repository.dart
- lib/presentation/screens/login_screen.dart
- lib/presentation/providers/auth_provider.dart
- lib/core/network/api_client.dart (token interceptor)

Şimdi başla.
```

---

## 👥 Senaryo 3: Sadece Hasta Yönetimi Modülü

```
Flutter projemde hasta yönetimi modülünü oluştur.

DOKÜMANTASYON: MOBILE-API-ENTEGRASYON.md bölüm "Patient Endpoints"

ENDPOINT'LER:
- GET /api/mobile/v1/patients (liste)
- POST /api/mobile/v1/patients (ekle/batch)
- GET /api/mobile/v1/patients/{id} (detay)
- PATCH /api/mobile/v1/patients/{id} (güncelle)
- DELETE /api/mobile/v1/patients/{id} (sil)

ÖZELLIKLER:
1. Hasta listesi (pull-to-refresh, arama)
2. Hasta ekleme formu (validation)
3. Hasta detay sayfası
4. Hasta düzenleme
5. Offline support (SQLite'a kaydet, offline_<uuid> ID)
6. Sync support (API üzerinden PostgreSQL'e)

DATA MODEL (MOBILE-API-ENTEGRASYON.md'den):
- id, fullName, tcNo, age, gender, risk, diabetesYears, hba1c, createdAt, isSynced

NOT: Yerel SQLite veritabanı, API üzerinden sunucudaki PostgreSQL ile senkronize olur.

DOSYALAR:
- lib/data/models/patient.dart (fromJson, toJson, toMap, fromMap)
- lib/data/local/database/patient_dao.dart (SQLite CRUD)
- lib/services/patient_service.dart (API calls)
- lib/data/repositories/patient_repository.dart (offline-first logic)
- lib/presentation/screens/patients/patients_list_screen.dart
- lib/presentation/screens/patients/add_patient_screen.dart
- lib/presentation/screens/patients/patient_detail_screen.dart
- lib/presentation/widgets/patient_card.dart
- lib/presentation/providers/patient_provider.dart

Adım adım oluştur. İlk adım: Patient model.
```

---

## 🔄 Senaryo 4: Sadece Senkronizasyon Modülü

```
Flutter projemde offline senkronizasyon modülünü oluştur.

DOKÜMANTASYON: MOBILE-API-ENTEGRASYON.md "Offline-First Stratejisi" ve "Sync Endpoint"

ENDPOINT:
- POST /api/mobile/v1/sync (toplu sync)
- GET /api/mobile/v1/sync (sync durumu)

SYNC AKIŞI:
1. Yerel DB'den unsyncedPatients ve unsyncedAnalyses al
2. POST /api/mobile/v1/sync ile gönder
3. Response'daki ID mapping'lerle yerel DB'yi güncelle
4. isSynced = true yap

ÖZELLIKLER:
1. Connectivity monitoring (connectivity_plus)
2. Otomatik sync (internet gelince)
3. Background sync (workmanager)
4. Manuel sync butonu
5. Sync progress indicator
6. Offline badge (unsync count)
7. Retry mechanism (hata durumunda)

DOSYALAR:
- lib/services/sync_service.dart
- lib/data/repositories/sync_repository.dart
- lib/core/utils/connectivity_utils.dart
- lib/presentation/widgets/sync_indicator.dart
- lib/presentation/widgets/offline_badge.dart

MOBILE-API-ENTEGRASYON.md'deki "Sync Service" Flutter örneğini baz al.

Şimdi başla.
```

---

## 🎨 Senaryo 5: Sadece UI/UX İyileştirme

```
Mevcut Flutter projemin UI/UX'ini iyileştir.

EKLENECEKLER:
1. Material Design 3 (Material You)
2. Dark mode support
3. Shimmer loading states
4. Empty states (özel illüstrasyonlar)
5. Error states (retry button)
6. Pull-to-refresh
7. Smooth animations (Hero, Fade, Slide)
8. Custom AppBar designs
9. Bottom navigation
10. Floating action buttons
11. Snackbar notifications
12. Offline indicator banner

KOD STANDARTLARI:
- Reusable widget'lar
- Theme kullan (colors, typography, spacing)
- Responsive design (tablet support)
- Accessibility (semantics)

DOSYALAR:
- lib/core/theme/app_theme.dart
- lib/core/theme/app_colors.dart
- lib/presentation/widgets/shimmer_loading.dart
- lib/presentation/widgets/empty_state.dart
- lib/presentation/widgets/error_state.dart
- lib/presentation/widgets/offline_banner.dart

Başla.
```

---

## 🐛 Senaryo 6: Hata Ayıklama ve İyileştirme

```
Flutter projemdeki şu sorunları çöz:

SORUNLAR:
1. [Sorunu buraya yaz, örn: "Sync çalışmıyor"]
2. [Sorunu buraya yaz, örn: "Token expire olunca crash oluyor"]
3. [Sorunu buraya yaz, örn: "Offline hasta eklenemiyor"]

DOKÜMANTASYON: MOBILE-API-ENTEGRASYON.md

LOGLARI PAYLAŞ:
```
[Error loglarını buraya yapıştır]
```

KODUMU PAYLAŞ:
```dart
// Sorunlu kodu buraya yapıştır
```

Şimdi analiz et ve çöz.
```

---

## 📱 Senaryo 7: Kamera ve Görüntü İşleme

```
Flutter projemde retina görüntüsü çekme ve analiz modülünü oluştur.

GEREKSİNİMLER:
1. Kamera ile görüntü çekme (camera package)
2. Galeriden görüntü seçme (image_picker)
3. Görüntü önizleme ve crop
4. Görüntüyü base64'e çevir (API'ye gönderim için)
5. AI analiz isteği gönder
6. Sonuç ekranı (AI confidence, heatmap)

ENDPOINT:
- POST /api/mobile/v1/analyses
  Body: { patientId, aiResult, confidence, originalImage (base64) }

DOSYALAR:
- lib/presentation/screens/analyses/add_analysis_screen.dart
- lib/presentation/screens/analyses/camera_screen.dart
- lib/presentation/screens/analyses/analysis_result_screen.dart
- lib/core/utils/image_utils.dart (base64 conversion)

ÖZELLIKLER:
- Offline support (görüntü local'e kaydet)
- Compress image (yüksek çözünürlük sorunu)
- Loading animation (analiz sırasında)

Başla.
```

---

## 🧪 Senaryo 8: Test Yazma

```
Flutter projeme unit ve integration testler ekle.

TEST KAPSAMI:
1. Unit Tests:
   - Model serialization (toJson/fromJson)
   - Repository logic (offline-first)
   - Service layer (API calls)
   - Utils (UUID generation, connectivity check)

2. Integration Tests:
   - Login flow
   - Offline hasta ekleme ve sync
   - API endpoint'leri (mock server)

DOSYALAR:
- test/models/patient_test.dart
- test/services/auth_service_test.dart
- test/repositories/patient_repository_test.dart
- integration_test/auth_flow_test.dart
- integration_test/offline_sync_test.dart

DEPENDENCIES:
- mockito
- http_mock_adapter
- integration_test

MOBILE-API-ENTEGRASYON.md "Test Stratejisi" bölümünü takip et.

Başla.
```

---

## 🔧 Senaryo 9: Özelleştirme İsteği

```
Flutter projeme şu özelliği ekle:

[ÖZELLİK TANIMI - Detaylı açıkla]

Örnek:
"Hasta listesinde filtreleme özelliği:
- Risk seviyesine göre (Yok, Düşük, Orta, Yüksek)
- Yaş aralığına göre (slider)
- HbA1c değerine göre
- Filtreleri temizle butonu
- Filtre sayısı badge'i"

DOKÜMANTASYON: MOBILE-API-ENTEGRASYON.md

ETKİLENECEK DOSYALAR:
- [Dosya listesi]

Şimdi implement et.
```

---

## 💡 Kullanım İpuçları

### Agent'a Prompt Verirken:

1. **Dosyaları ekle**: Prompt'la birlikte ilgili .md dosyalarını da ekle
2. **Açık ol**: Ne istediğini net belirt
3. **Adım adım**: Büyük görevlerde "adım adım" de
4. **Referans ver**: "MOBILE-API-ENTEGRASYON.md'deki X bölümünü takip et" de
5. **Kontrol et**: Üretilen kodu dokümantasyonla karşılaştır

### ChatGPT/Claude için:
```
Dosyaları yükle > Prompt gir > "Adım adım ilerleyelim" de
```

### GitHub Copilot Chat için:
```
@workspace MOBILE-API-ENTEGRASYON.md dosyasını referans alarak hasta yönetimi modülünü oluştur.
```

### Cursor AI için:
```
Cmd+K > Prompt gir > Dosyaları @ ile mention et
```

---

## ✅ Başarı Kriterleri

Agent'ın ürettiği kod:
- ✅ **MOBILE-API-ENTEGRASYON.md** ile uyumlu
- ✅ Offline-first prensiplerine uygun
- ✅ Error handling var
- ✅ Loading states var
- ✅ Clean code (SOLID, DRY)
- ✅ Type-safe (null safety)
- ✅ Yorumlu ve anlaşılır

---

Hangi senaryoyu kullanacağına karar ver ve agent'ına ver! 🚀

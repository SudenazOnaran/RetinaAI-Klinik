# RetinaAI Klinik — Canlıya Alma Planı

Son güncelleme: Faz 4 — Kapsamlı denetim tamamlandı.

---

## P1 — KRİTİK (Uygulama çöküşüne neden olan)

### P1-1: Eksik rotalar — `/upload`, `/loading`, `/results`
- **Etkilenen dosya:** `lib/router/router.dart`
- **Sorun:** `UploadScreen` → `context.go('/loading')`, `LoadingScreen` → `context.go('/results')` çağrıları yapıyor ama bu rotalar `GoRouter`'a kayıtlı değil → 404 GoException hatası
- **Düzeltme:** Üç rotayı da router'a ekle
- **Durum:** ✅ Düzeltildi

### P1-2: `/patients/detail` rota modeli uyuşmazlığı
- **Etkilenen dosya:** `lib/router/router.dart`, `lib/features/patients/patient_detail_screen.dart`
- **Sorun:** Router `extra is! PatientModel` bekliyor; ancak yeni eklenen API hastaları `PatientApiModel` tipinde geliyor → detay sayfası "Hasta detayı bulunamadı" hatasıyla açılıyor
- **Düzeltme:** `PatientDetailScreen` → `PatientApiModel` kullan; router guard güncelle
- **Durum:** ✅ Düzeltildi

### P1-3: `PatientsScreen` — sabit/demo veri
- **Etkilenen dosya:** `lib/screens/patients_screen.dart`
- **Sorun:** Ekranda gerçek API/SQLite değil, hard-coded `_PatientRecord` listesi gösteriliyor; hasta eklenince listede görünmüyor
- **Düzeltme:** `ConsumerStatefulWidget` yap, `patientApiProvider` bağla
- **Durum:** ✅ Düzeltildi

---

## P2 — YÜKSEK (Kırık özellikler, yanlış veri)

### P2-1: `RecentPatientsScreen` eski in-memory provider kullanıyor
- **Etkilenen dosya:** `lib/screens/recent_patients_screen.dart`
- **Sorun:** `ref.watch(patientListProvider)` → eski `PatientModel` listesi (hard-coded 5 kayıt)
- **Düzeltme:** `patientApiProvider` bağla, son 4 hastayı göster
- **Durum:** ✅ Düzeltildi

### P2-2: `HomeDashboardScreen` — doktor adı sabit kodlanmış
- **Etkilenen dosya:** `lib/screens/home_dashboard_screen.dart`
- **Sorun:** "Dr. Arda Yılmaz" sabit yazılı; gerçek giriş yapan doktor adı gösterilmiyor
- **Düzeltme:** `ConsumerWidget` yap, `authProvider.state.doctor?.fullName` kullan
- **Durum:** ✅ Düzeltildi

### P2-3: `SettingsScreen` — çıkış (logout) butonu yok
- **Etkilenen dosya:** `lib/screens/settings_screen.dart` (router'da kullanılan)
- **Sorun:** Kullanıcı uygulamadan çıkamıyor; logout akışı kayıt dışı
- **Düzeltme:** `ConsumerWidget` yap, "Çıkış Yap" butonu ekle → `authProvider.notifier.logout()`
- **Durum:** ✅ Düzeltildi

### P2-4: `UploadScreen` analiz simülasyonu — gerçek API yok
- **Etkilenen dosya:** `lib/screens/upload_screen.dart`
- **Sorun:** Görsel seçilip `_startAnalysis()` çağrıldığında sadece `Future.delayed` yapılıyor; `AnalysisService.add()` hiç çağrılmıyor
- **Düzeltme:** Seçilen görsel + seçili hasta bilgisini `AnalysisService.add()` ile kaydet, ardından `/loading` rotasına geç
- **Durum:** ✅ Düzeltildi

---

## P3 — ORTA (Kod kalitesi, tekrar eden dosyalar)

### P3-1: İki `patients_screen.dart` dosyası
- `lib/screens/patients_screen.dart` → router'da kullanılıyor ✅
- `lib/features/patients/patients_screen.dart` → router'da YOK, ölü kod
- **Düzeltme:** `lib/features/patients/patients_screen.dart` sil
- **Durum:** ✅ Silindi

### P3-2: İki `settings_screen.dart` dosyası
- `lib/screens/settings_screen.dart` → router'da kullanılıyor ✅  
- `lib/features/settings/settings_screen.dart` → router'da YOK, ölü kod
- **Düzeltme:** `lib/features/settings/settings_screen.dart` sil
- **Durum:** ✅ Silindi

### P3-3: Kullanılmayan eski `HomeScreen`
- `lib/screens/home_screen.dart` → router'da kayıtlı değil, ölü kod
- **Düzeltme:** Sil
- **Durum:** ✅ Silindi

### P3-4: `lib/features/dashboard/dashboard_screen.dart` — kopya panel
- Router'da `HomeDashboardScreen` kullanılıyor; `features/dashboard/` altındaki sürüm ölü kod
- **Düzeltme:** `lib/features/dashboard/dashboard_screen.dart` sil
- **Durum:** ✅ Silindi

### P3-5: Eski `patientListProvider` ve `PatientModel` hâlâ var
- `lib/core/providers/patient_provider.dart` → artık kullanılmıyor
- `lib/core/models/patient_model.dart` → artık kullanılmıyor
- **Düzeltme:** Her iki dosyayı sil
- **Durum:** ✅ Silindi

### P3-6: `syncProvider` UI'a bağlanmadı
- `lib/core/providers/sync_provider.dart` var ama hiçbir ekranda gösterilmiyor
- **Düzeltme:** `SettingsScreen`'e son senkronizasyon tarihi ve "Şimdi Senkronize Et" butonu ekle
- **Durum:** ✅ Düzeltildi (SettingsScreen içine eklendi)

---

## P4 — DÜŞÜK (İyileştirme)

### P4-1: WorkManager uygulanmadı
- `pubspec.yaml`'da `workmanager ^0.5.2` var ama hiç kullanılmıyor
- **Önerim:** Şimdilik kaldır veya MVP sonrası bırak
- **Durum:** ⏳ Sonraki sprint

### P4-2: İki `BottomNav` widget'ı var
- `lib/widgets/clinic_bottom_nav.dart` — tüm ekranlarda kullanılan
- `lib/widgets/main_bottom_nav_bar.dart` — Riverpod tabanlı, hiç kullanılmıyor
- **Düzeltme:** `main_bottom_nav_bar.dart` sil
- **Durum:** ✅ Silindi

### P4-3: `baseUrl` hâlâ `localhost`
- `lib/core/constants/api_constants.dart` → `http://localhost:9002`
- Canlıya almadan önce production domain'e çevrilmeli
- **Durum:** ⏳ Deployment öncesi

---

## Klasör Yapısı (Düzenleme)

### Silinen dosyalar (ölü kod)
| Dosya | Neden |
|---|---|
| `lib/screens/home_screen.dart` | Router'da yok, `HomeDashboardScreen` kullanılıyor |
| `lib/features/dashboard/dashboard_screen.dart` | `HomeDashboardScreen` ile birebir kopya |
| `lib/features/patients/patients_screen.dart` | `lib/screens/patients_screen.dart` kullanılıyor |
| `lib/features/settings/settings_screen.dart` | `lib/screens/settings_screen.dart` kullanılıyor |
| `lib/core/models/patient_model.dart` | `PatientApiModel` ile değiştirildi |
| `lib/core/providers/patient_provider.dart` | `patientApiProvider` ile değiştirildi |
| `lib/widgets/main_bottom_nav_bar.dart` | `ClinicBottomNav` kullanılıyor |

### Korunan yapı
```
lib/
├── main.dart
├── core/
│   ├── constants/api_constants.dart
│   ├── network/api_client.dart
│   ├── providers/
│   │   ├── auth_provider.dart
│   │   ├── patient_api_provider.dart
│   │   ├── sync_provider.dart
│   │   └── navigation_provider.dart
│   └── utils/
│       ├── connectivity_utils.dart
│       └── uuid_generator.dart
├── data/
│   ├── models/
│   │   ├── patient_api_model.dart
│   │   ├── analysis_api_model.dart
│   │   └── doctor_model.dart
│   ├── local/
│   │   ├── database/ (app_database, patient_dao, analysis_dao)
│   │   └── secure_storage.dart
│   └── repositories/ (auth, patient, analysis, sync)
├── services/ (auth, patient, analysis, sync)
├── features/
│   ├── patients/
│   │   ├── add_patient_screen.dart  ← API bağlı ✅
│   │   └── patient_detail_screen.dart ← PatientApiModel ✅
│   ├── calendar/, reports/
├── screens/  ← tüm ana ekranlar burada
│   ├── splash_screen.dart, sign_in_screen.dart (auth flow)
│   ├── home_dashboard_screen.dart ← authProvider bağlı ✅
│   ├── patients_screen.dart ← patientApiProvider bağlı ✅
│   ├── recent_patients_screen.dart ← patientApiProvider bağlı ✅
│   ├── settings_screen.dart ← logout + sync UI ✅
│   ├── upload_screen.dart ← AnalysisService bağlı ✅
│   ├── loading_screen.dart, results_screen.dart
│   └── ...
├── router/router.dart ← tüm rotalar eksiksiz ✅
├── theme/app_theme.dart
└── widgets/ (shared)
```


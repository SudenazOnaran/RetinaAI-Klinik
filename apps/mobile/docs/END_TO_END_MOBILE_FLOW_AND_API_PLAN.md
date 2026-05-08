# Retina AI - End-to-End Mobile Flow ve API Entegrasyon Plani

Bu dokuman, mobil uygulamada giristen kayit olmaya, yonetici girisine, yonetici paneline, hasta kayit-raporlama-detaylandirma akisina kadar tum gecisleri adim adim tanimlar.
Ayrica web/server endpoint baglantisini hangi asamada yapmaniz gerektigini netlestirir.

## 1) Hedef ve Kapsam

Bu planda 4 ana hedef var:
1. Tum sayfa gecislerini netlestirmek (kullanici, doktor, admin).
2. Her ekranin hangi veriyi okuyup/yazdigini belirlemek.
3. Endpoint entegrasyonunu dogru siraya koymak.
4. Her faz icin teslim kriteri (Definition of Done) belirlemek.

## 2) Mevcut Aktif Route Haritasi (Kodda olan)

Router dosyasina gore aktif route listesi:
- `/` -> splash
- `/onboarding1`
- `/onboarding2`
- `/onboarding3`
- `/signin`
- `/signup`
- `/pricing`
- `/home`
- `/patients`
- `/patients/new`
- `/patients/detail` (PatientModel extra ile)
- `/reports`
- `/calendar`
- `/settings`
- `/profile`

Not:
- `add patient` sonrasi artik `patients/detail` aciliyor.
- Su an admin login ve admin panel route'u ayri bir rol bazli guard ile ayrismamis durumda.

## 3) Hedef Uc Uca Kullanici Akislari

### 3.1 Doktor/Klinik kullanicisi
1. Splash
2. Onboarding (opsiyonel, ilk acilis)
3. Sign In
4. Home Dashboard
5. Yeni Kayit (`/patients/new`)
6. Kaydet
7. Hasta Detay (`/patients/detail`)
8. Rapor Olustur / AI Analiz / Klinik not
9. Rapor Kaydet
10. Patients listesine geri don

### 3.2 Kayit Olma akisi
1. Sign In ekranindan Sign Up
2. Doktor/klinik kayit formu
3. Basarili kayit -> Sign In
4. Ilk giris -> Home Dashboard

### 3.3 Yonetici (Admin) akisi - hedef
1. Admin Login (`/admin/login`)
2. Admin Panel (`/admin/dashboard`)
3. Kullanici yonetimi (doktorlar, klinikler)
4. Hasta kayit raporlarina erisim (read-only veya role bazli)
5. AI analiz gecmisi ve sistem loglari
6. Cikis

## 4) Sayfa Gecisleri - Net Baglanti Matrisi

| Nereden | Nereye | Kosul | Not |
|---|---|---|---|
| `/` | onboarding veya `/signin` | ilk acilis kontrolu | local storage flag |
| onboarding | `/signin` | son slide tamam | skip/continue |
| `/signin` | `/home` | login basarili | token + rol bilgisi alinir |
| `/signin` | `/signup` | kayit ol tiklandi | mevcut |
| `/home` | `/patients` | Hasta Kayitlari butonu | mevcut |
| `/home` | `/patients/new` | Yeni Kayit butonu | mevcut |
| `/patients/new` | `/patients/detail` | Kaydet basarili | mevcut (extra ile) |
| `/patients/detail` | `/reports` veya list | rapor kaydedildi | eklenecek aksiyon |
| `/home` | `/reports`, `/calendar`, `/settings`, `/profile` | alt/ust menu | mevcut |
| `/signin` | `/admin/dashboard` | rol=admin | eklenecek guard |
| `/admin/login` | `/admin/dashboard` | admin auth basarili | eklenecek |

## 5) Rol Bazli Mimari (Zorunlu)

Roller:
- `doctor`
- `assistant` (opsiyonel)
- `admin`

Zorunlu kurallar:
1. Route guard olmadan role separation yapmayin.
2. Admin route'lari ayri namespace altinda olsun (`/admin/*`).
3. JWT icindeki role claim ile guard karar versin.
4. Token yoksa her zaman `/signin`.
5. Role uyusmuyorsa `403` ekranina yonlendir.

## 6) Hasta Kaydi -> Detay -> Rapor Akisi (Detay Tasarim)

### 6.1 Add Patient ekraninda olmasi gerekenler
1. Zorunlu alan validasyonlari: ad-soyad, TC, yas araligi.
2. Klinik metrikler: HbA1c vb.
3. Kaydette local state + API create (fazina gore).
4. Basarili sonuc: yeni hasta id ile detail ekranina gecis.

### 6.2 Patient Detail ekraninda olmasi gerekenler
1. Hasta ozet karti.
2. Rapor olusturma formu.
3. AI analiz bolumu (opsiyonel).
4. Klinik karar destek metni.
5. Raporu kaydet butonu.
6. Kayit sonrasi rapor numarasi ve timestamp gosterimi.

### 6.3 Raporlama
1. Draft kaydetme.
2. Final rapor kaydetme.
3. PDF/Paylasim (opsiyonel sonraki faz).
4. Rapor revizyon gecmisi (kritik).

## 7) Endpoint Entegrasyonu - Ne Zaman Baglanmali?

Kisa cevap:
- Ekranlarin ana flow'u stabil olmadan endpoint baglamayin.
- En erken baglanacak kisim auth + session yonetimi.
- Sonra patient CRUD.
- Sonra report ve AI.

Dogru sira:
1. Auth endpointleri
2. User profile + role endpointleri
3. Patient CRUD
4. Report CRUD
5. AI analyze endpointleri
6. Admin endpointleri
7. Dosya/PDF/export endpointleri

## 8) Fazlara Gore Uygulama Plani

## Faz 0 - Stabil Navigasyon ve Mock Veri
Amaç: UI akislari kopmadan calissin.

Yapilacaklar:
1. Tum route gecislerini test et.
2. Kaydet -> detay gecisini sabitle.
3. `state.extra` yerine kalici id bazli detail route planla (`/patients/:id`).
4. Hata ekranlari: not found, unauthorized, server error.

Teslim kriteri:
- Tum sayfalar crash olmadan acilir.
- Tum butonlar anlamli bir route'a gider.

## Faz 1 - Auth ve Session
Amaç: Gercek login ve rol yonetimi.

Endpointler:
1. `POST /api/v1/auth/login`
2. `POST /api/v1/auth/register`
3. `POST /api/v1/auth/refresh`
4. `POST /api/v1/auth/logout`
5. `GET /api/v1/me`

Kritik noktalar:
1. Access token kisa omurlu, refresh token guvenli saklanmali.
2. `401` durumunda otomatik refresh + retry.
3. Session timeout UX belirlenmeli.

Teslim kriteri:
- Login/logout/refresh stabil.
- Role gore route guard aktif.

## Faz 2 - Patient CRUD
Amaç: Hasta kaydini server ile gercege gecirmek.

Endpointler:
1. `POST /api/v1/patients`
2. `GET /api/v1/patients`
3. `GET /api/v1/patients/{id}`
4. `PATCH /api/v1/patients/{id}`
5. `DELETE /api/v1/patients/{id}` (soft delete tercih)

Kritik noktalar:
1. TC gibi hassas alanlar maskeleme ile loglanmali.
2. Pagination, search, filter server-side olmali.
3. Optimistic update sadece guvenli aksiyonlarda kullanilsin.

Teslim kriteri:
- Add patient server'a yazar.
- Detail ekrani id ile server'dan okur.

## Faz 3 - Report Modulu
Amaç: Raporu kalici hale getirmek.

Endpointler:
1. `POST /api/v1/reports`
2. `GET /api/v1/reports/{id}`
3. `GET /api/v1/patients/{id}/reports`
4. `PATCH /api/v1/reports/{id}`
5. `POST /api/v1/reports/{id}/finalize`

Kritik noktalar:
1. Draft ve final rapor status'u ayrilmali.
2. Finalize sonrasi immutable alanlar tanimlanmali.
3. Audit trail zorunlu.

Teslim kriteri:
- Rapor draft/final akisi calisir.
- Rapor gecmisi listelenir.

## Faz 4 - AI Analiz Entegrasyonu
Amaç: Fundus gorseli analizini rapora baglamak.

Endpointler:
1. `POST /api/v1/ai/analyze` (async job)
2. `GET /api/v1/ai/jobs/{jobId}`
3. `POST /api/v1/reports/{id}/attach-ai-result`

Kritik noktalar:
1. AI sonucu nihai tani degildir uyarisi zorunlu.
2. AI confidence, model version, inference time saklanmali.
3. Timeout/retry stratejisi net olmali.

Teslim kriteri:
- AI sonucu rapor formuna aktarilir.
- Doktor onayi olmadan final rapora gitmez.

## Faz 5 - Admin Login ve Admin Panel
Amaç: Yonetim tarafini role-based tamamlamak.

Endpointler:
1. `POST /api/v1/admin/login`
2. `GET /api/v1/admin/dashboard/metrics`
3. `GET /api/v1/admin/users`
4. `PATCH /api/v1/admin/users/{id}/role`
5. `GET /api/v1/admin/audit-logs`

Kritik noktalar:
1. Admin endpointleri ayri yetki katmaninda olmali.
2. Tum admin aksiyonlari audit loglanmali.
3. Kritik islemlerde 2FA degerlendirilmeli.

Teslim kriteri:
- Admin panel sadece admin role ile acilir.
- Kullanici/rol yonetimi calisir.

## 9) Web Kismindaki Server'a Endpoint Baglama Zamani

Sorudaki en kritik kisim bu:
- Endpoint baglama isi Faz 1'de baslamali (auth ile).
- Tum endpointleri bir anda baglamayin.
- Her fazda sadece o fazin endpointleri baglansin.

Onerilen teknik sira:
1. `api_client` katmani kur (Dio/HTTP).
2. Ortak `interceptor` (token, refresh, error map).
3. Her domain icin repository: auth, patient, report, ai, admin.
4. UI katmani sadece repository/service kullansin.
5. Mock -> staging -> production gecisinde base URL env ile degissin.

## 10) Kritik Teknik Kararlar

1. Detail route'u `extra` yerine `:id` ile kaliciya cevirin.
2. Offline durum icin minimum cache planlayin.
3. Her API cagrisinda standart hata modeli kullanin.
4. PII alanlari (TC, telefon) maskeleme + encrypted storage.
5. Klinik kararlarda AI metni her zaman "yardimci arac" olarak etiketlensin.

## 11) Test Stratejisi

### 11.1 Zorunlu test paketleri
1. Unit: validator, mapper, repository.
2. Widget: form validasyonlari, buton enabled/disabled durumlari.
3. Integration: login -> add patient -> detail -> report save.
4. Golden (opsiyonel): kritik ekranlarin mobil gorunum stabilitesi.

### 11.2 Kabul testleri (UAT)
1. Doktor giris yapar, hasta ekler, detay acilir.
2. Rapor kaydeder, listede gorur.
3. Admin login ile panel metriklerini gorur.
4. Yetkisiz rol admin route'una giremez.

## 12) Adim Adim Ilerleme Plani (Pratik)

Hafta 1:
1. Route guard altyapisi.
2. Auth endpoint baglantisi.
3. Session yonetimi.

Hafta 2:
1. Patient CRUD endpointleri.
2. `/patients/:id` detay route gecisi.
3. Listeleme + arama + filtre.

Hafta 3:
1. Report draft/final endpointleri.
2. Rapor gecmisi.
3. PDF/export ilk surum.

Hafta 4:
1. AI analiz endpoint baglantisi.
2. Sonuc aktarim ve doktor onay akisi.
3. Klinik uyari metinleri ve hukuki metinler.

Hafta 5:
1. Admin login + panel.
2. Audit logs.
3. Security hardening.

## 13) Bu projede bir sonraki somut adim

Bir sonraki teknik adim olarak asagidaki 3 isi birlikte yapin:
1. `/patients/detail` route'unu `/patients/:id` formatina cevirin.
2. Patient detail ekranini provider veya repository uzerinden `id` ile veri ceker hale getirin.
3. Auth + role guard middleware'ini GoRouter redirect katmanina ekleyin.

Bu 3 adim tamamlandiginda endpoint entegrasyonu guvenli ve olceklenebilir sekilde baslayabilir.

## 14) Mevcut Kod Durumu - Eksik ve Kirik Kisimlar (Guncelleme: Nisan 2026)

### 14.1 Route Haritasina Sonradan Eklenen Route'lar (Bolum 2 Guncelleme)
Asagidaki route'lar kodda mevcut olmakla birlikte Bolum 2'deki listede yer almiyordu:
- `/patients/recent` -> RecentPatientsScreen
- `/notifications` -> NotificationsScreen
- `/upload` -> UploadScreen
- `/loading` -> LoadingScreen
- `/results` -> ResultsScreen

### 14.2 Kritik Duzeltme Gerektiren Ekranlar

#### Loading Screen (`/loading`) - KIRIK
- Mevcut durum: 6 saniyelik sabit `Timer` ile sahte gecikme.
- Olmasi gereken: `AnalysisService` uzerinden periyodik polling; analiz tamamlaninca otomatik `/results`'a gecis.
- Bagli endpoint: `GET /api/mobile/v1/analyses/{id}`

#### Results Screen (`/results`) - KIRIK
- Mevcut durum: Risk seviyesi, confidence skoru ve heatmap URL'si hardcoded.
- Olmasi gereken: `AnalysisApiModel` provider'dan okunmali; `analysisProvider` kurulmali.
- Bagli model alanlari: `aiResult`, `confidence`, `heatmapUrl`, `doctorNote`.

#### Upload Screen (`/upload`) - YANLIS VERI
- Mevcut durum: `patientId` alani `doctor.id` ile dolduruluyor.
- Olmasi gereken: Caller ekrandan (PatientDetail) gercek `patientId` `GoRouter`'in `extra` parametresi ile gecilmeli.
- Duzeltilecek yer: `UploadScreen` widget constructor ve router `extra` tanimi.

#### Profile Screen (`/profile`) - HARDCODED
- Mevcut durum: `"Dr. Arda Yilmaz"` string sabit.
- Olmasi gereken: `authProvider.state.doctor?.fullName` okunmali.
- Ek eksik: Profil duzenleme (ad, uzmanlik, hastane) endpointi baglanmamis.

#### Home Dashboard (`/home`) - KISMI HARDCODED
- Mevcut durum: `"12 yeni fundus"` sayisi sabit string.
- Olmasi gereken: `patientApiProvider` uzerinden analiz bekleyen hasta sayisi hesaplanmali.

### 14.3 Hic Backend'e Baglanmamis Ekranlar

| Ekran | Eksik | Hedef Endpoint |
|-------|-------|----------------|
| Sign Up (`/signup`) | Repository/Service yok, UI tamamlanmis | `POST /api/mobile/v1/auth/register` |
| Reports (`/reports`) | 1 adet hardcoded rapor var | `GET /api/mobile/v1/reports` |
| Calendar (`/calendar`) | Saf UI, veri yok | `GET/POST /api/mobile/v1/appointments` |
| Notifications (`/notifications`) | 3 demo bildirim, statik | `GET /api/mobile/v1/notifications` |

### 14.4 Production Oncesi Zorunlu Teknik Isler

1. **API Base URL**: `lib/core/constants/api_constants.dart` icindeki `http://localhost:9002` adresi ortam degiskeniyle (`--dart-define` veya `.env`) yonetilmeli. Localhost uretimde calismiyor.

2. **analysisProvider**: `ResultsScreen` ve `LoadingScreen` icin `patientApiProvider` ornegine benzer `StateNotifierProvider` olusturulmali. `AnalysisService.getById(id)` ve `AnalysisService.getByPatientId(patientId)` metodlari provider'a baglanmali.

3. **Detail Route ID Gecisi**: Bolum 13'te belirtildigi uzere `/patients/detail` route'u `state.extra` yerine `/patients/:id` seklinde degistirilmeli; detay ekrani provider'dan id ile veri cekmeli.

4. **Rol Guard**: `GoRouter` `redirect` callback'ine JWT claim kontrolu eklenmeli; admin role olmadan `/admin/*` route'lari erisime kapali olmali.

5. **Sign Up Akisi**: `SignUpScreen` formu doldurunca hic bir sey olmuyor. `AuthRepository.register()` metodu ve servis cagrisi eklenmeli; basarili kayit sonrasi `/signin`'e yonlendirmeli.

### 14.5 Temizlenmesi Gereken Kullanilmayan Kod

| Dosya / Bag. | Neden Kaldirilmali |
|---|---|
| `lib/core/providers/navigation_provider.dart` | `navigationIndexProvider` hicbir widget tarafindan izlenmiyor; eski mimari kalintisi |
| `pubspec.yaml` - `workmanager` | Hicbir dosyada import edilmiyor |
| `pubspec.yaml` - `cached_network_image` | Hicbir dosyada import edilmiyor |
| `pubspec.yaml` - `shimmer` | Hicbir dosyada import edilmiyor |

### 14.6 Oncelik Sirasi (Bu Asamadan Sonraki Somut Adimlar)

1. `Upload -> Loading -> Results` akisini gercek veriyle calisan hale getir (analysisProvider + polling).
2. `patientId`'yi UploadScreen'e caller'dan gecir.
3. `ProfileScreen`'i `authProvider`'a bagla.
4. `SignUp` akisini tamamla (repository + servis).
5. API baseUrl'i ortam degiskeniyle yonet.
6. Detail route'u `/patients/:id` formatina cevir.
7. Kullanilmayan bagimlilik ve provider'lari temizle.

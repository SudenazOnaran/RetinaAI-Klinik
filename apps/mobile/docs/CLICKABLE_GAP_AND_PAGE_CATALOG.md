# Clickable Gap and Page Catalog

Bu dokuman, projedeki mevcut sayfalarda kullanici tarafinda tiklanabilir gorunen veya teknik olarak tiklanabilir olan alanlari tarar.
Amac: etkisi olmayan buton/yazi alanlari icin hangi sayfalarin (veya aksiyon ekranlarinin) acilmasi gerektigini netlestirmek.

## 1) Kapsam ve Not

- Router'da aktif kullanilan ana ekranlar tarandi:
  - /home
  - /patients
  - /patients/new
  - /patients/detail
  - /reports
  - /calendar
  - /settings
  - /profile
  - /signin
  - /signup
  - onboarding/splash
- Ek olarak `lib/features/*` altinda aktif route disi ama ileride tekrar kullanilabilecek kopya ekranlar da tarandi.
- "Etkisiz" = tiklama var ama callback bos (`onTap: () {}` veya `onPressed: () {}`).
- "Gorunurde buton" = UI buton gibi, ancak callback yok (Container/Text gibi).

## 2) Aktif Ekranlarda Etkisiz Tiklamalar ve Onerilen Sayfalar

## 2.1 Home Dashboard (`lib/screens/home_dashboard_screen.dart`)

1. Bildirim ikonu (onPressed bos)
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `NotificationsScreen`
   - Onerilen route: `/notifications`
   - Oncelik: P1

2. "Tumunu Gor" (Son Kaydedilen Hastalar)
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `RecentPatientsScreen` veya mevcut `PatientsScreen`e filtreli gecis
   - Onerilen route: `/patients?view=recent`
   - Oncelik: P1

3. "Hizli Mudahale Gerekenleri Gor"
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `CriticalPatientsScreen`
   - Onerilen route: `/patients/high-risk`
   - Oncelik: P1

Home'da zaten calisanlar:
- Hasta Kayitlari -> `/patients`
- Yeni Kayit -> `/patients/new`

## 2.2 Patients (`lib/screens/patients_screen.dart`)

1. Ustteki arama ikonu (onPressed bos)
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `AdvancedPatientSearchScreen` (filtre/siralama paneli)
   - Onerilen route: `/patients/search`
   - Oncelik: P2

2. Kart icindeki "Detaylar" butonu (onPressed bos)
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: Mevcut `PatientDetailScreen`
   - Onerilen route: `/patients/:id`
   - Oncelik: P1

Gorunurde buton ama tiklanmayan alanlar:
- `Risk Seviyesi` kutusu
- `Analiz Sayisi` kutusu
- `Sort` kutusu
- Sayfalama kutulari (`<`, `1`, `2`, `3`, `12`)

Oneri:
- Bunlari `InkWell`/`GestureDetector` ile aktiflestir.
- Filtreler icin bottom sheet veya yeni route kullan (`/patients/filter`).

## 2.3 Reports (`lib/screens/reports_screen.dart`)

1. AI dogrulama `EVET`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `AiValidationConfirmScreen` (kisa karar ozeti)
   - Onerilen route: `/reports/ai/confirm`
   - Oncelik: P1

2. AI dogrulama `HAYIR`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `AiFeedbackScreen` (neden reddedildi formu)
   - Onerilen route: `/reports/ai/reject`
   - Oncelik: P1

3. `Analizi Baslat`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `AiAnalysisRunScreen` (upload + job durumu)
   - Onerilen route: `/reports/ai/run`
   - Oncelik: P1

4. Alt bardaki `Taslak`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `DraftReportsScreen`
   - Onerilen route: `/reports/drafts`
   - Oncelik: P2

5. Alt bardaki `Raporu Kaydet`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `ReportSaveResultScreen` (kayit basari + rapor no)
   - Onerilen route: `/reports/save-result`
   - Oncelik: P1

## 2.4 Calendar (`lib/screens/calendar_screen.dart`)

1. Yesil banner'daki `X` (kapat)
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen: Sayfa degil, local state ile banner kapansin.
   - Oncelik: P2

2. Sol/Sag ay gecis oklari
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen: Sayfa degil, ay/yil state degissin.
   - Oncelik: P1

3. `Not Ekle`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `CalendarNoteCreateScreen`
   - Onerilen route: `/calendar/notes/new`
   - Oncelik: P2

## 2.5 Settings (`lib/screens/settings_screen.dart`)

1. `Ayarlari Kaydet`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `SettingsSaveResultScreen` (veya toast/dialog)
   - Onerilen route: `/settings/save-result` (opsiyonel)
   - Oncelik: P1

Gorunurde buton ama tiklanmayan alanlar:
- `Dil Secimi` karti
- `Gece Modu` karti

Oneri:
- Dil icin `LanguageSettingsScreen` -> `/settings/language`
- Tema icin `ThemeSettingsScreen` -> `/settings/theme`

## 2.6 Profile (`lib/screens/profile_screen.dart`)

1. `Hasta Kayitlari` butonu
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen route: `/patients`
   - Oncelik: P1

2. `Yeni Kayit` butonu
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen route: `/patients/new`
   - Oncelik: P1

3. `Tumunu Gor` (son kaydedilen hastalar)
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen route: `/patients?view=recent`
   - Oncelik: P2

Gorunurde buton ama tiklanmayan alan:
- `Hizli Mudahale Gereklendiri Gor` (kirmizi kutu)
  - Onerilen route: `/patients/high-risk`

## 2.7 Patient Detail (`lib/features/patients/patient_detail_screen.dart`)

1. AI bolumunde `EVET`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen: Sayfa veya modal onay ekrani
   - Onerilen route: `/patients/:id/ai/confirm`
   - Oncelik: P1

2. AI bolumunde `HAYIR`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen ekran: `AiResultCorrectionScreen`
   - Onerilen route: `/patients/:id/ai/reject`
   - Oncelik: P1

3. AI bolumunde `Temizle`
   - Mevcut: Hicbir sey yapmiyor.
   - Onerilen: Sayfa degil, confirm dialog + form reset.
   - Oncelik: P2

4. `Sonucu Forma Aktar`
   - Mevcut: Disabled.
   - Onerilen: AI sonucu geldiginde aktif olup alanlari doldursun.
   - Oncelik: P1

Not:
- Bu ekranda `Raporu Kaydet` su an SnackBar veriyor (etkili), ancak server tarafina kaydetme henuz yok.

## 3) Home Screen ile Baglantili Acilabilecek Ekran Onerileri

Home uzerinden acilabilecek mantikli ekranlar:

1. NotificationsScreen -> `/notifications`
2. RecentPatientsScreen -> `/patients?view=recent`
3. CriticalPatientsScreen -> `/patients/high-risk`
4. TodayTasksScreen -> `/tasks/today` (opsiyonel)
5. AiInsightsDetailScreen -> `/insights/weekly` (opsiyonel)
6. DoctorProfileScreen -> `/profile` (avatar tiklanabilir yapilacaksa)

## 4) Aktif Route Disi Features Kopyalarinda da Etkisiz Alanlar Var

Asagidaki dosyalar aktif router'da kullanilmiyor ama bos callback iceriyor:

- `lib/features/dashboard/dashboard_screen.dart`
- `lib/features/patients/patients_screen.dart`
- `lib/features/calendar/calendar_screen.dart`
- `lib/features/settings/settings_screen.dart`

Oneri:
1. Tek kaynak secin (`lib/screens` veya `lib/features`).
2. Digerini deprecate edin veya kaldirin.
3. Cift dosya nedeniyle ayni buton iki yerde farkli kalmasin.

## 5) Oncelikli Uygulama Sirasi (Adim Adim)

## Adim 1 (Hemen)
1. Profile ekranindaki 3 bos butonu bagla.
2. Patients ekraninda `Detaylar` butonunu `/patients/:id`e bagla.
3. Home ekraninda `Bildirim`, `Tumunu Gor`, `Hizli Mudahale` butonlarini bagla.

## Adim 2
1. Calendar ay oklarini calisir hale getir.
2. `Not Ekle` icin yeni sayfa ac.
3. Settings `Ayarlari Kaydet` aksiyonunu backend yoksa local state + toast yap.

## Adim 3
1. Reports AI aksiyonlari icin ekranlari ac.
2. Draft kaydet ve final kaydet akislarini ayir.
3. Patient detail AI `EVET/HAYIR/TEMIZLE` aksiyonlarini tamamla.

## 6) Teknik Kural (Onemli)

- Kullanici tikladiginda hicbir sey olmamasi engellenmeli.
- Tiklama vardir ama is yoksa:
  1. ya ilgili route'a gitmeli,
  2. ya dialog/bottom sheet acmali,
  3. ya da buton devre disi gorunmeli (disabled) ve nedenini aciklamali.

Bu kural tum ekranlarda standart hale getirilmelidir.

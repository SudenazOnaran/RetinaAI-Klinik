# Son Kontroller (Doktor Pilotu + Yayina Hazirlik + Satis Oncesi)

Tarih: 2026-03-24
Kapsam: frontend, backend, islevsellik, guvenlik, performans, operasyon, ticarilestirme

## 0) Hemen Sonuc (Kisa)

- Urun pilot/PoC seviyesinde kullanilabilir ama dogrudan satisa hazir degil.
- En kritik engeller: production build kilit problemi, bagimlilik guvenlik aciklari, AI servis CORS/rate-limit mimarisi, test kapsami ve operasyonel hardening eksikleri.

---

## 1) Teknik Kontrol Ozeti (Bu incelemede dogrulanan)

- `npm run ci`: PASS
  - lint/typecheck/test calisti.
  - Unit test: 3 dosya, 10 test PASS.
  - Not: lint warningleri var (unused vars, `no-img-element` vb.)
- `npm run build`: FAIL
  - Hata: `EPERM: operation not permitted, open .next/trace`
- `npm audit --omit=dev`: FAIL
  - 25 acik (1 critical, 3 high, 2 moderate, 19 low)
  - Kritik: `jspdf` CVE/GHSA kayitlari

Guncel durum (2026-03-24):

- `npm run build`: PASS
  - `.next-dev` / `.next-build` ayrimi ve `distDir` env baglantisi ile build stabil.
- `npm audit --omit=dev`: PASS
  - 0 acik (critical/high/moderate/low = 0)

---

## 2) P0 - Yayina/Satisa Engel (Oncelik 1)

1. Production build kilit problemi cozulmeli

- Durum: Tamamlandi.
- Risk: CI/CD ve release alinamaz.
- Yapilacak:
  - [x] Build oncesi `.next-build` temizligi + ayrik dist policy.
  - [x] `NEXT_DIST_DIR` ile dev/build/start cikti dizinleri ayrildi.
  - [x] `next.config.ts` icine `distDir: process.env.NEXT_DIST_DIR || ".next"` eklendi.
  - [x] Build dogrulamasi: `npm run build` PASS.

2. Bagimlilik guvenligi (kritik) temizlenmeli

- Durum: Tamamlandi.
- Risk: Guvenlik denetiminden gecememe, kurumsal satis engeli.
- Yapilacak:
  - [x] `jspdf` guvenli surume guncellendi.
  - [x] `next` guvenli patch surume alindi (`15.5.14`).
  - [x] Transitif aciklar icin `overrides` eklendi (`@tootallnate/once`, `effect`, `fast-xml-parser`).
  - [x] Dogrulama: `npm audit --omit=dev` sonucu 0 acik.

3. AI servis CORS kisitlanmali

- Durum: Tamamlandi.
- Risk: istenmeyen originlerden erisim, yuzey genislemesi.
- Yapilacak:
  - [x] Allowed origins whitelist eklendi (env: `AI_CORS_ALLOWED_ORIGINS`, comma-separated).
  - [x] Allowed methods kisitlandi (`POST`, `OPTIONS`).
  - [x] Allowed headers kisitlandi (`Content-Type`, `X-AI-Gateway-Key`).
  - [x] CORS yalnizca `/predict` endpointine uygulandi.

4. AI servis rate limit daginik yapiya alinmali

- Durum: Tamamlandi.
- Risk: multi-instance ortamda etkisiz, restartta sifirlaniyor.
- Yapilacak:
  - [x] Redis tabanli merkezi limiter eklendi (env: `AI_RATE_LIMIT_REDIS_URL`).
  - [x] Endpoint bazli kota ayarlari env ile parametrik hale getirildi (`AI_RATE_LIMIT_WINDOW_SECONDS`, `AI_RATE_LIMIT_MAX_REQUESTS`).
  - [x] Anahtar namespace kontrolu eklendi (`AI_RATE_LIMIT_REDIS_PREFIX`).
  - [x] Redis ulasilamazsa guvenli fallback olarak in-memory limiter korunuyor.

5. Object storage erisiminde sahiplik (ownership) kontrolu sertlestirilmeli

- Durum: Tamamlandi.
- Risk: Yanlis key ile baska kayitlara erisim riski.
- Yapilacak:
  - [x] Object key segmentinde doktor sahipligi zorunlulugu eklendi (`key[0] == session.doctorId`).
  - [x] `patientId != unknown` durumunda DB tabanli doktor-hasta sahiplik kontrolu eklendi.
  - [x] Basarisiz sahiplik kontrolunde 403 donuluyor.
  - [x] Basarili object read islemlerinde `DOWNLOAD` audit log kaydi eklendi.

---

## 3) P1 - Islevsellik/Guvenlik/Veri Kalitesi (Oncelik 2)

1. Hasta olusturma aksiyonlarinda server-side validasyon guclendirilmeli

- Durum: Tamamlandi.
- Risk: bozuk/eksik veri, hatali klinik akis.
- Yapilacak:
  - [x] Ortak `zod` tabanli server-side validasyon modulu eklendi.
  - [x] TCKN format + checksum dogrulamasi (11 hane + algoritmik kontrol) eklendi.
  - [x] Yas, diyabet yili, HbA1c aralik kontrolleri create/update aksiyonlarina uygulandi.
  - [x] Metin alanlari icin trim + uzunluk kisitlari eklendi.
  - [x] `tcNo` icin doktor bazli unique kontrol create akisina eklendi.
  - [x] Unit test eklendi (`patient-validation.test.ts`).

2. Hassas veri loglama ve veri minimizasyonu

- Durum: Tamamlandi.
- Risk: KVKK/GDPR kapsaminda gereksiz PII izi.
- Yapilacak:
  - [x] Kayıt akislarindaki PII iceren console loglar redakte edildi (email/name acik yazilmiyor).
  - [x] Hasta olusturma audit metadata'sinda tam TC/fullName kaldirildi; maskeli alan standardi uygulandi.
  - [x] Kullanici kayit audit metadata'sinda e-posta alani kaldirildi (minimum gerekli veri prensibi).

3. Gecici sifre akisi hardening

- Durum: Tamamlandi.
- Risk: istemci/transport/screenshot ile sizma riski.
- Yapilacak:
  - [x] "first login password reset required" zorunlulugu eklendi (login akisi reset olmadan oturum acmiyor).
  - [x] Gecici sifre policy tablosu eklendi (`DoctorCredentialPolicy`) ve TTL kontrolu uygulandi.
  - [x] Gecici sifre artik register API cevabinda donulmuyor; yonetici tarafinda girilip guvenli kanal ile paylasiliyor.
  - [x] Tek seferlik reset endpointi eklendi (`/api/doctor/password/reset-temp`) ve reset sayfasi (`/reset-password`) devreye alindi.

4. Public health endpoint stratejisi

- Durum: Tamamlandi.
- Risk: servis fingerprinting.
- Yapilacak:
  - [x] Dis dunyada kisitli health (redacted) donuluyor.
  - [x] Detayli health verisi sadece token ile (`details=1` + `x-monitoring-token`) erisilebilir hale getirildi.

5. API hata mesajlarinda operasyon bilgisi sizmasi azaltilmali

- Durum: Tamamlandi.
- Risk: saldiri yuzeyi bilgisi.
- Yapilacak:
  - [x] Kullaniciya genel hata mesaji, log tarafina detayli hata prensibi login/register/reset API'lerinde uygulandi.
  - [x] Hata kodu standardizasyonu (`errorCode`) ile istemci yonlendirme ve operasyonal ayrisim guclendirildi.

---

## 4) P1 - Frontend/UX/Tasarim (Oncelik 2)

1. Performans: `img` -> `next/image`

- Durum: Tamamlandi (kritik ekranlar migrate edildi).
- Risk: LCP ve bant genisligi maliyeti artisi.
- Yapilacak:
  - [x] Kritik ekranlarda `next/image` migration (hasta detay ve analiz karti).
  - [x] `sizes` ve responsive image policy uygulandi.

2. Hastalar sayfasi server-side pagination/sorting

- Durum: Tamamlandi.
- Risk: hasta sayisi artinca yavaslama/memory artisi.
- Yapilacak:
  - [x] query param tabanli server pagination + server-side sorgu uygulandi.
  - [x] filtre/siralama server tarafina tasindi (search/risk/analiz/date/sort).

3. Tasarim iyilestirme (doktor pilotu icin)

- Durum: Tamamlandi.
- Yapilacak:
  - [x] Klinik gorunumde kritik risk hiyerarsisi guclendirildi (acil strip + acil etiket).
  - [x] Hasta listesinde "son analiz tarihi / son guven skoru / acil etiket" alanlari eklendi.
  - [x] Doktor aksiyonlarini hizlandiran sticky "Hizli islemler" paneli eklendi.
  - [x] Mobil tek el kullanim icin alt aksiyon cubugu ve daha buyuk butonlar eklendi.

4. Erisilebilirlik

- Durum: Tamamlandi.
- Yapilacak:
  - [x] Form alanlari icin ARIA etiketleri/semantik tanimlar eklendi (label, aria-label, aria-live, table caption/scope).
  - [x] Klavye ile gezinme icin odak gorunurlugu ve focus ring iyilestirmeleri uygulandi.
  - [x] Renk kontrast iyilestirmeleri yapildi (dusuk kontrastli metin tonlari guclendirildi).

---

## 5) P1 - Test ve Kalite Guvencesi (Oncelik 2)

1. E2E kapsamini genislet

- Durum: Tamamlandi (env-guarded klinik cekirdek ve yetki matris senaryolari eklendi).
- Yapilanlar:
  - [x] yeni E2E dosyasi eklendi: `e2e/patient-crud.spec.ts`
  - [x] unauthenticated hasta sayfalari redirect senaryosu eklendi.
  - [x] env-guarded hasta create/update/delete E2E senaryosu eklendi (`E2E_RUN_PATIENT_CRUD=1`).
- Kalan senaryolar:
  - [x] analiz yukleme + AI fallback queue (`e2e/ai-predict-queue.spec.ts`, `E2E_RUN_AI_PREDICT=1`, opsiyonel `E2E_EXPECT_AI_QUEUE=1`)
  - [x] rapor olusturma/PDF (`e2e/report-pdf.spec.ts`, `E2E_RUN_REPORT_PDF=1`)
  - [x] KVKK consent + anonymize (`e2e/kvkk-consent-anonymize.spec.ts`, `E2E_RUN_KVKK=1`)
  - [x] role-based yetki testleri (DOCTOR/ASSISTANT/MANAGER/AUDITOR) (`e2e/role-access.spec.ts`, `E2E_RUN_ROLE_ACCESS=1`)

2. API integration testleri

- Durum: Tamamlandi (env-guarded fault senaryolari dahil).
- Yapilacak:
  - [x] auth-required endpoint matrix (`e2e/api-integration.spec.ts`)
  - [x] validation failure matrix (`e2e/api-integration.spec.ts`, `E2E_RUN_API_VALIDATION=1`)
  - [x] migration drift/DB baglanti hata senaryolari (`e2e/api-integration.spec.ts`, fault-injection modunda `E2E_RUN_API_DB_FAILURE=1`)

3. Lint warninglerini sprint ile sifirla

- Durum: Tamamlandi.
- Hedef: release branchte warning budget <= 0 veya tanimli budget.
- Yapilanlar:
  - [x] Kullanilmayan import/degisken/fonksiyon warningleri temizlendi (AI flow, dashboard, hooks, gateway).
  - [x] Dogrulama: `npm run lint` sonucu warning/error = 0.

---

## 6) P1 - DevOps/Operasyon (Oncelik 2)

1. Env ornek dosyalari ve runbook

- Durum: Tamamlandi.
- Yapilanlar:
  - [x] `.env.example` eklendi; `.env.onprem.example` ve `.env.vpc.example` release gereksinimleriyle guncellendi.
  - [x] Fail-fast env dogrulama scripti eklendi (`scripts/check-required-env.mjs`).
  - [x] Zorunlu env listesi ve matrix dokumani eklendi (`docs/env-fail-fast-matrix.md`).
  - [x] Operasyon runbook eklendi (`docs/operasyon-runbook.md`).

2. Release gate standardi

- Durum: Tamamlandi.
- Yapilanlar:
  - [x] `release:check` scripti env-check + ci + e2e + build akisini kapsayacak sekilde guncellendi.
  - [x] CI pipeline `release:check` adimini zorunlu calistiracak sekilde guncellendi (`.github/workflows/ci.yml`).
  - [x] Build kilit/EPERM icin otomatik temizleme scripti eklendi (`scripts/clean-next-artifacts.mjs`) ve build akisina baglandi.

3. Gozlemlenebilirlik

- Durum: Tamamlandi.
- Yapilanlar:
  - [x] Middleware seviyesinde request-id uretimi/propagasyonu eklendi (`x-request-id`).
  - [x] Structured logger ve opsiyonel merkezi log ingest destegi eklendi (`src/lib/structured-logger.ts`).
  - [x] Health/backup/object endpointlerinde request-id + structured log uygulandi.
  - [x] p95 latency, error-rate, queue depth esik kontrolleri health metriclerinde devreye alindi (`src/lib/monitoring-alerts.ts`).

4. Yedekleme ve geri donus testleri

- Durum: Tamamlandi.
- Yapilanlar:
  - [x] Restore endpoint eklendi: `POST /api/storage/backup/restore` (dry-run destekli).
  - [x] Restore helper ile sure (duration) ve RPO saat hesaplamasi eklendi (`restoreObjectStorageBackup`).
  - [x] Tatbikat proseduru ve kanit formati dokumani eklendi (`docs/backup-restore-tatbikat.md`).

---

## 7) Klinik Satisa Ozel Gereksinimler (Oncelik 3 ama stratejik)

1. Regulator uyumluluk paketi

- Durum: Adim 1 tamamlandi (gap analizi + artefakt envanteri).
- Yapilanlar:
  - [x] ISO 14971 / IEC 62304 / ISO 13485 icin ilk seviye mevcut-eksik matrisi hazirlandi.
  - [x] Uyumluluk paketi Adim 1 dokumani eklendi: `docs/regulator-uyumluluk-paketi-adim-1.md`.
  - [x] Adim 2 icin resmi dokuman backlog'u ve RACI taslagi cikartildi.
  - [x] Adim 2 sablon artefaktlari olusturuldu (`docs/compliance/*`).
  - [x] Adim 2 artefaktlari proje-gerceklerine gore ilk taslak (v0.2-draft) dolduruldu.
- Kalan:
  - [ ] ISO 14971 residual risk karari ve release bazli resmi onay.
  - [ ] IEC 62304 safety class kesinlestirme ve traceability kanit baglantilarinin release-run ile kapanmasi.
  - [ ] ISO 13485 QMS prosedur setinin onayli surume alinmasi (dokuman kontrol/CAPA kayitlari ile).
  - [ ] Klinik validasyon raporu (duyarlilik/ozgulluk/per-site) ve istatistiksel ekler.

2. Kurumsal entegrasyon hazirligi

- SSO (SAML/OIDC), audit export, HL7/FHIR/PACS yol haritasi.

3. Ticari paketleme

- SLA paketleri, destek akisi (L1/L2/L3), onboarding dokumanlari.

---

## 8) Doktor Arkadasinla Pilot Test Plani (1-2 hafta)

1. Klinik is akisi testi

- Yeni hasta ac -> analiz yukle -> AI sonucunu incele -> doktor notu -> rapor PDF.

2. Guven testi

- Bilerek hatali dosya yukle, buyuk dosya yukle, art arda login dene.

3. Kullanilabilirlik testi

- "Nerede takildin?" notlari topla (ozellikle hasta detay ve analiz ekrani).

4. Cikti degeri testi

- Raporu gercek klinik notla karsilastir: "karar destek degeri var mi?"

5. Olcum

- Islem suresi (once/sonra), hata sayisi, manuel duzeltme ihtiyaci.

---

## 9) Uygulama Sirasi (Net)

1. P0 maddelerini kapat (build kilidi, audit kritikler, CORS/rate-limit, object ownership).
2. E2E + API test kapsamini klinik akislara genislet.
3. Frontend performans ve UX iyilestirmelerini yap (`next/image`, server pagination, mobil aksiyonlar).
4. Operasyonel runbook + env example + izleme/alarmlari tamamla.
5. Doktor pilotundan gelen geri bildirimle ikinci tur iyilestirme yap.
6. Sonrasinda satis gorusmelerine gec.

---

## 10) Hazirlik Kriteri (Go/No-Go)

GO icin minimum:

- Build stabil PASS (kilit sorunu yok)
- `npm audit` kritik/high = 0
- Klinik cekirdek E2E senaryolari PASS
- Yetki/sahiplik testleri PASS
- Pilot doktor memnuniyet puani >= 8/10

Bu 5 kriter saglanmadan dogrudan satisa cikma: NO-GO.

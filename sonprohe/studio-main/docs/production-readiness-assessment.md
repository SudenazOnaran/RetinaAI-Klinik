# Retina AI - Uretim/Yayina Hazirlik ve Klinik Ticarilestirme Degerlendirmesi

Tarih: 2026-03-23
Kapsam: `sonprohe/studio-main` kod tabani, API katmani, model servisi (`app.py`), test/build olgunlugu, guvenlik ve klinik regülasyon acisindan urunlesme uygunlugu.

## Kisa Karar

**Karar: HAYIR (su an kliniklere satilip canliya alinacak seviyede degil).**

Neden:

- Teknik temel guclu ama **guvenlik, regülasyon, operasyonel guvenilirlik ve urun kalitesi** acisindan kritik bosluklar var.
- Build zinciri ve kalite kapilari production standardinda degil.
- Klinik AI urunu icin gerekli formal dogrulama/sertifikasyon katmanlari eksik.

## Kanit Ozetleri

- Test sonucu: `npm run test` -> **3/3 dosya, 10/10 test gecti**.
- Build sonucu (Windows): `npm run build` -> **FAIL**
  - `'NODE_ENV' is not recognized as an internal or external command`.

## Skor Karti (10 uzerinden)

- Urun fonksiyonelligi: **7/10**
- Guvenlik ve veri koruma: **4/10**
- Multi-tenant yetkilendirme: **4/10**
- MLOps / model yonetimi: **3/10**
- Regülasyon / medikal uygunluk: **2/10**
- Test / kalite guvencesi: **4/10**
- DevOps / operasyon / izlenebilirlik: **4/10**
- Ticari olgunluk (destek, SLA, onboarding): **5/10**

## Mevcut Guclu Yonler

- Hasta, rapor, AI analiz, PDF, gecmis raporlar, dashboard akislarinin uca uca calismasi.
- Rol bazli dashboard erisim kurallari mevcut.
- AI servis kesintisinde kuyruga alma/fallback mantigi var.
- Audit log ve pilot metrik toplama altyapisi var.
- KVKK odakli anonimlestirme endpointleri baslangic seviyesinde mevcut.
- Klinik odakli rapor semasi (`manual_report_v2`) dogru yonelim.

## Kritik Riskler (P0 - Yayina Engel)

1. Build zinciri platforma bagli ve kirik

- `package.json` icindeki build komutu Windows'ta calismiyor (`NODE_ENV=production next build`).
- Sonuc: CI/CD ortamlari ve ekip ortamlari arasinda tutarsizlik, yayin riski.

2. Build-time kalite kapilari devre disi

- `next.config.ts` icinde:
  - `typescript.ignoreBuildErrors: true`
  - `eslint.ignoreDuringBuilds: true`
- Sonuc: tip/lint hatalari production'a sizabilir.

3. Varsayilan (fallback) gizli anahtarlar kodda sabit

- Session secret fallback: `auth-session.ts`.
- AI gateway secret fallback: `ai-gateway.ts` ve `app.py`.
- Sonuc: ortam degiskeni yanlis kurulumunda tahmin edilebilir secret ile calisma riski.

4. Kayit endpointi acik (self-signup)

- `/api/doctor/register` acik; davet/approval akisi yok.
- Sonuc: yetkisiz hesap acma ve kurumsal uyumluluk riski.

5. Medikal regülasyon seviyesi yetersiz

- CE/FDA/MDR kapsaminda beklenen formal klinik validasyon, risk yonetimi (ISO 14971), yazilim yasam dongusu (IEC 62304), kalite yonetim sistemi (ISO 13485) kanitlari yok.
- Sonuc: klinik satis/kurumsal satin alma sureclerinde gecememe riski cok yuksek.

## Onemli Riskler (P1)

1. Multi-tenant veri erisimi korumalari sertlestirilmeli

- Storage object erisiminde session var, ancak object key bazli sahiplik dogrulamasi ve ayrintili policy katmani guclendirilmeli.

2. Test kapsamı dar

- Sadece 3 lib testi var; kritik akislar icin entegrasyon/E2E yok.
- Ornek: login/register, hasta/rapor olusturma, PDF olusturma, API authz, KVKK akislari.

3. Runtime DDL kullanimi

- Audit ve AI queue tablolari runtime'da `CREATE TABLE IF NOT EXISTS` ile olusuyor.
- Kurumsal DB yonetiminde migration kontrollu yapi tercih edilir.

4. Model yonetimi ve performans izleme eksik

- Model versiyonlama, drift izleme, dataset lineage, threshold governance ve rollback playbooklari eksik.

5. Guvenlik sertlestirmeleri eksik

- Kapsamli rate limiting, account lockout, brute-force koruma, WAF stratejisi, merkezi secret yönetimi ve anahtar rotasyonu eksik.

## Klinikte Satis Icin Gerekli Ozellikler (Tam Liste)

## 1) Urun / Klinik Islevsellik

- Hastane Bilgi Yonetim Sistemleri entegrasyonu (HL7/FHIR).
- DICOM/PACS uyumlulugu.
- Kurum bazli coklu tenant izolasyonu (organization/site).
- Klinik workflow motoru (onay, ikinci gorus, konsültasyon).
- Gelişmiş raporlama şablonlari ve kurum bazli ozellestirme.

## 2) Guvenlik / Gizlilik

- Zorunlu MFA (ozellikle manager/auditor).
- SSO (SAML/OIDC) kurumsal kimlik entegrasyonu.
- At-rest encryption (gorseller, yedekler), KMS/Vault entegrasyonu.
- Field-level masking (TC, ad-soyad).
- Veri tutma/silme politikasi ve otomatik purging.
- KVKK/GDPR tam riza ve isleme envanteri yonetimi.

## 3) Regülasyon / Kalite

- ISO 13485 uyumlu QMS kurulumu.
- IEC 62304 yazilim yasam dongusu artefaktlari.
- ISO 14971 risk analiz dosyalari (FMEA/FTA).
- Klinik performans calismasi (prospektif + cok merkezli).
- Post-market surveillance ve CAPA surecleri.

## 4) AI/MLOps

- Model registry (versiyon, metadata, onay durumu).
- Calibration, uncertainty, OOD detection raporlama.
- Drift tespiti (input/data/concept drift) ve alarm.
- Per-site performans dashboardu (sens/spec/PPV/NPV).
- Reproducible training pipeline ve dataset governance.

## 5) Operasyon / DevOps

- CI/CD quality gates (lint + typecheck + unit + e2e + security scan).
- IaC (Terraform vb.) ve environment parity.
- SLO/SLA metrikleri (uptime, p95 latency, error budget).
- DR/BCP (felaket kurtarma), restore testleri.
- Merkezi loglama/izleme (SIEM, APM, alerting).

## 6) Ticari / Destek

- Onboarding playbook (klinik kurulum checklist).
- Rol bazli egitim materyali (doktor/asistan/yonetici).
- SLA paketleri (bronze/silver/gold) ve olay yonetimi.
- Destek süreçleri: L1/L2/L3 ve eskalasyon.
- Sozlesmesel guvenceler: DPA, BAA, KVKK ek protokolleri.

## Neden Su An Basarili Sonuc Garantilenemez?

- Mevcut sistem prototip/erken urun asamasinda guclu; ancak klinik satis ve canli kullanim icin gereken **guvenlik + regülasyon + operasyonel olgunluk** seviyesi tamamlanmamis.
- Teknik olarak pilot calismalarda deger uretebilir; fakat kurumsal satin alma komiteleri ve hukuk/regülasyon denetimlerinden gecme olasiligi dusuk.

## Hedefe Ulasmak Icin Oncelikli Yol Haritasi

## Ilk 30 Gun (P0 kapatma)

- Build scriptini cross-platform yap (`cross-env NODE_ENV=production next build`).
- `next.config.ts` icindeki build hata bastirma ayarlarini kaldir.
- Fallback secret kullanimini kaldir; secret yoksa uygulama fail-fast acilsin.
- Public register endpointini kapat; invite-only veya manager onayli hale getir.
- Basit security hardening: login rate limit + lockout.

## 31-60 Gun (P1 kapatma)

- E2E testler (auth, patient/report, pdf, kvkk, storage authz).
- Storage object erisiminde sahiplik policy guclendirme.
- Runtime DDL yerine migration tabanli tablo yonetimi.
- Merkezi observability (structured logs + tracing + alerts).

## 61-120 Gun (Klinik urunlesme)

- Klinik validasyon protokolu ve performans raporu.
- Model registry + drift monitoring + calibration dashboard.
- Regülasyon dokumantasyon paketi (IEC 62304 / ISO 14971 girdileri).
- Kurumsal entegrasyonlar (FHIR/HL7, SSO, audit export).

## Sonuc

**Bu haliyle: pilot/PoC icin uygun, dogrudan klinik satis ve genis capli yayina uygun degil.**

**Urunlestirme potansiyeli var**; yukaridaki P0/P1 adimlari tamamlanir ve klinik-regülasyon katmani eklenirse basarili ticarilestirme mumkun olur.

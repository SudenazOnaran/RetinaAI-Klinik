# Regulator Uyumluluk Paketi - Adim 1

Tarih: 2026-03-24
Kapsam: ISO 14971, IEC 62304, ISO 13485 icin ilk seviye gap analizi ve artefakt envanteri.
Amac: Uyumluluk paketinin uygulanabilir backlog'unu olusturmak ve sorumluluklari netlestirmek.

## 1) Adim 1 Ciktisi

Bu adim sonunda su ciktilar hazirlandi:

- Standart bazli artefakt envanteri
- Mevcut durum / eksik durum matrisi
- Kanit konumu (repo ici dosya referanslari)
- Adim 2 icin uretilmesi gereken zorunlu dokuman backlog'u

## 2) Standart Bazli Ilk Gap Matrisi

### ISO 14971 (Risk Yonetimi)

- Gerekli temel artefaktlar:
  - Risk Yonetim Plani
  - Tehlike Analizi (hazard list)
  - Risk degerlendirme ve kontrol kayitlari
  - Residual risk kabul raporu
  - Post-market izleme plani
- Mevcut kanit:
  - Guvenlik/hardening bulgulari ve duzeltmeler: docs/production-readiness-assessment.md
  - Operasyonel risklere yonelik runbook: docs/operasyon-runbook.md
- Durum: KISMEN VAR
- Kritik eksik:
  - Formal risk register yok
  - Risk kabul kriterleri yazili degil
  - Clinical safety hazard katalogu yok

### IEC 62304 (Yazilim Yasam Dongusu)

- Gerekli temel artefaktlar:
  - Software Development Plan
  - Software Architecture Description
  - Requirement -> Test izlenebilirlik matrisi
  - Problem resolution proseduru
  - Release/konfig yonetim kayitlari
- Mevcut kanit:
  - Teknik backlog ve adim bazli ilerleme: son kontroller.md
  - CI/release gate: .github/workflows/ci.yml ve package.json release:check
  - Test artefaktlari: e2e/*.spec.ts, src/lib/*.test.ts
- Durum: KISMEN VAR
- Kritik eksik:
  - Formal SDLC policy dokumani yok
  - Requirement-test traceability matrix yok
  - Yazilim guvenlik sinifi/justification dokumani yok

### ISO 13485 (Kalite Yonetim Sistemi)

- Gerekli temel artefaktlar:
  - QMS kapsam ve proses tanimlari
  - Dokuman kontrol proseduru
  - CAPA / degisiklik yonetimi
  - Egitim kayitlari ve sorumluluk matrisi
  - Tedarikci/dependency kalite kriterleri
- Mevcut kanit:
  - Operasyonel runbook ve env matrix dokumanlari
  - Audit log ve izlenebilirlik altyapisi (uygulama seviyesinde)
- Durum: BASLANGIC
- Kritik eksik:
  - QMS seviyesinde politika/prosedur seti yok
  - CAPA kayit formati yok
  - Dokuman versiyon/approval akisi tanimli degil

## 3) Klinik Validasyon Raporu Hazirlik Durumu

- Hedef rapor: duyarlilik/ozgulluk/per-site performans raporu.
- Mevcut durum: model ve klinik akis var, fakat formal validasyon protokolu dokumani yok.
- Kritik eksik:
  - Veri seti secim kriterleri
  - Gold standard etiketleme protokolu
  - Site bazli istatistiksel rapor formati

## 4) Adim 2 Backlog (Uretilecek Resmi Dokumanlar)

- docs/compliance/iso-14971-risk-management-plan.md
- docs/compliance/iso-14971-risk-register.csv
- docs/compliance/iec-62304-software-development-plan.md
- docs/compliance/iec-62304-traceability-matrix.csv
- docs/compliance/iso-13485-qms-scope-and-procedures.md
- docs/compliance/clinical-validation-protocol.md

Adim 2 ilerleme (2026-03-24):

- docs/compliance/iso-14971-risk-management-plan.md (sablon olusturuldu)
- docs/compliance/iso-14971-risk-register.csv (sablon olusturuldu)
- docs/compliance/iec-62304-software-development-plan.md (sablon olusturuldu)
- docs/compliance/iec-62304-traceability-matrix.csv (sablon olusturuldu)
- docs/compliance/iso-13485-qms-scope-and-procedures.md (sablon olusturuldu)
- docs/compliance/clinical-validation-protocol.md (sablon olusturuldu)
- Iceriklerin proje-gercek gereksinimler ile ilk taslak doldurmasi yapildi (v0.2-draft).
- Dokuman onaylari (Product/Clinical + Security/Compliance + Operations) tamamlanmadi.
- Klinik validasyon raporunun veri ile calistirilmis ilk resmi cikti paketi hazir degil.

## 5) RACI (Ilk Taslak)

- Product/Clinical Owner:
  - Klinik kabul kriterleri
  - Clinical validation kapsam onayi
- Tech Lead:
  - IEC 62304 dokuman seti
  - Traceability matrix
- Security/Compliance Owner:
  - ISO 14971 risk register ve residual risk karari
- Operations Owner:
  - ISO 13485 prosedur ve kayit seti

## 6) Adim 1 Tamamlanma Kriteri (Bu teslimde saglandi)

- Standart bazli artefakt envanteri olusturuldu.
- Mevcut/eksik durum netlestirildi.
- Adim 2 dokuman backlog'u yazildi.
- Sorumluluk dagilimi ilk taslak olarak belirlendi.
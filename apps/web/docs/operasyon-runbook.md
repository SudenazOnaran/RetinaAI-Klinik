# Operasyon Runbook

Bu runbook, P1 DevOps/Operasyon adimlarini canliya hazir sekilde uygulamak icin operasyon ekibine yoneliktir.

## 1) Release Oncesi Kontrol Sirasi

1. npm ci
2. npm run env:check:release
3. npm run release:check

Beklenen cikti:

- lint/typecheck/test/e2e/build adimlarinin tamami PASS
- env-check PASS

## 2) EPERM ve Build Kilidi Temizligi

Asagidaki script, build oncesi otomatik calisir:

- npm run clean:next-artifacts

Temizlenen kritik artefaktlar:

- .next/trace
- .next-build/trace
- .next-dev/trace
- Next cache dizinleri

## 3) Monitoring Uclari

- Public health: GET /api/monitoring/health
- Tokenli detayli health: GET /api/monitoring/health?details=1 + x-monitoring-token
- Alarm listesi: GET /api/doctor/monitoring/alerts
- Deployment/SLA profili: GET /api/doctor/monitoring/deployment-profile

## 4) Backup ve Restore Operasyonu

### Backup

- POST /api/storage/backup
- Yetki: MANAGER veya DOCTOR

### Restore (tatbikat/canli)

- POST /api/storage/backup/restore
- Yetki: MANAGER
- Ornek payload:
  {
  "backupDir": "optional/backup/path",
  "dryRun": true
  }

Dry-run onerilir. Tatbikatta once dryRun=true, sonra dryRun=false uygulanir.

## 5) RTO/RPO Kanit Kaydi

Her restore tatbikatinda su alanlar kaydedilmelidir:

- Tatbikat tarihi
- Kullanilan backup klasoru
- Backup timestamp
- Restore suresi (ms)
- Hesaplanan RPO (saat)
- Sonuc (PASS/FAIL)
- Olay sorumlusu

Aylik en az 1 tatbikat zorunludur.

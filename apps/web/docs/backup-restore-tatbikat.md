# Backup/Restore Tatbikat Proseduru

Bu dokuman, object storage icin aylik geri donus tatbikati ve RTO/RPO kanit kaydi icin kullanilir.

## 1) Hazirlik

- Rol: MANAGER
- Backup endpoint: POST /api/storage/backup
- Restore endpoint: POST /api/storage/backup/restore

## 2) Tatbikat Adimlari

1. Yeni backup al:
   - POST /api/storage/backup
2. Dry-run restore calistir:
   - POST /api/storage/backup/restore
   - Body: { "dryRun": true }
3. Gercek restore calistir:
   - POST /api/storage/backup/restore
   - Body: { "dryRun": false }
4. API cevabindaki durationMs ve rpoHours degerlerini rapora isle.

## 3) Kanit Formati

Her tatbikatta asagidaki satir doldurulur:

- Tarih:
- Operator:
- Backup dizini:
- Dry-run sonucu: PASS/FAIL
- Gercek restore sonucu: PASS/FAIL
- durationMs:
- rpoHours:
- Notlar:

## 4) Kabul Kriteri

- RTO: SLA_RTO_HOURS hedefinin altinda olmali.
- RPO: SLA_RPO_HOURS hedefinin altinda olmali.
- En az ayda 1 tatbikat kaydi zorunlu.

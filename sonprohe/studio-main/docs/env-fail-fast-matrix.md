# Env Fail-Fast Matrix

Bu dokuman, release oncesi zorunlu environment degiskenlerini ve dogrulama modlarini aciklar.

## 1) Dogrulama Komutlari

- Gelistirme kontrolu: npm run env:check
- Release kontrolu: npm run env:check:release
- Tam release gate: npm run release:check

## 2) Modlara Gore Zorunlu Degiskenler

### Tum modlarda zorunlu

- DATABASE_URL
- AI_GATEWAY_SHARED_SECRET
- DEPLOYMENT_PROFILE
- SESSION_SECRET veya NEXTAUTH_SECRET (en az biri)

### Sadece release modunda zorunlu

- INTERNAL_HEALTH_TOKEN
- PILOT_METRICS_CRON_SECRET
- AI_SERVICE_URL
- AI_CORS_ALLOWED_ORIGINS
- PROFILE_VERIFY_EMAIL_WEBHOOK_URL
- PROFILE_VERIFY_SMS_WEBHOOK_URL
- MONITORING_P95_LATENCY_MS
- MONITORING_ERROR_RATE_PERCENT
- MONITORING_QUEUE_DEPTH_THRESHOLD
- SLA_UPTIME_TARGET_PERCENT
- SLA_P1_RESPONSE_MINUTES
- SLA_P1_RESOLUTION_HOURS
- SLA_P2_RESPONSE_HOURS
- SLA_BACKUP_FREQUENCY_HOURS
- SLA_RPO_HOURS
- SLA_RTO_HOURS

## 3) Profil Bazli Notlar

### ON_PREM

- AI_RATE_LIMIT_REDIS_URL bos kalabilir (in-memory fallback).
- AI_CORS_ALLOWED_ORIGINS klinik ag URL listesi ile sinirlandirilmalidir.

### VPC

- AI_RATE_LIMIT_REDIS_URL merkezi redis endpoint olmalidir.
- LOG_INGEST_URL ve LOG_INGEST_TOKEN merkezi log toplama icin tanimlanmalidir.

## 4) Fail-Fast Prensipleri

- Zorunlu degisken yoksa release gate basarisiz olur.
- Eksik env listesi konsola acikca yazdirilir.
- Build oncesi kontrol calisir; yanlis konfig ile canliya cikis engellenir.

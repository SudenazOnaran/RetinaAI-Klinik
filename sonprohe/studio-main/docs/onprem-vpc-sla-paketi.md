# On-Premise / VPC Kurulum ve SLA Paketi

Bu dokuman, Item 11 kapsaminda operasyon ekiplerinin kullanimi icin hazirlandi.

## 1) Deployment Profilleri

### On-Premise

- `DEPLOYMENT_PROFILE=ON_PREM`
- Uygulama, klinik ic agda izole sekilde calistirilir.
- Veritabani, object storage ve AI servisi ayni kurum aginda konumlanir.
- Internet cikisi sadece gerekli endpointler icin whitelist ile acilir.

### VPC

- `DEPLOYMENT_PROFILE=VPC`
- Uygulama private subnet'te calisir.
- Veritabani private endpoint ile erisilir.
- WAF + security group + bastion/VPN ile erisim sinirlanir.
- Secrets yonetimi cloud secret manager uzerinden yapilir.

## 2) SLA Hedefleri (Varsayilan)

- Uptime hedefi: `%99.5`
- P1 ilk yanit: `15 dakika`
- P1 cozum hedefi: `4 saat`
- P2 ilk yanit: `4 saat`
- Yedekleme sikligi: `24 saat`
- RPO hedefi: `24 saat`
- RTO hedefi: `8 saat`

Bu degerler ortam degiskenleri ile degistirilebilir:

- `SLA_UPTIME_TARGET_PERCENT`
- `SLA_P1_RESPONSE_MINUTES`
- `SLA_P1_RESOLUTION_HOURS`
- `SLA_P2_RESPONSE_HOURS`
- `SLA_BACKUP_FREQUENCY_HOURS`
- `SLA_RPO_HOURS`
- `SLA_RTO_HOURS`

## 3) Operasyonel Kontrol Noktalari

- Saglik kontrolu: `GET /api/monitoring/health`
- Alarm kayitlari: `GET /api/doctor/monitoring/alerts`
- Deployment/SLA profili: `GET /api/doctor/monitoring/deployment-profile`

## 4) Olay Yonetimi

### P1 (Kritik)

- Klinik operasyonu durduran kesinti.
- On-call ekibi 15 dk icinde geri donus yapar.
- Gecici workaround veya rollback 4 saat hedefinde uygulanir.

### P2 (Yuksek)

- Kismi fonksiyon kaybi, manuel workaround var.
- 4 saat icinde geri donus yapilir.
- Planli duzeltme ayni is gunu veya takip eden pencerede alinır.

## 5) Yedekleme ve Geri Donus

- Object storage yedegi API uzerinden tetiklenebilir: `POST /api/storage/backup`.
- Object storage restore API: `POST /api/storage/backup/restore` (`dryRun` destekli).
- Veritabani yedegi kurum standardi (snapshot veya pg_dump) ile gunluk alinmalidir.
- Kurtarma testleri ayda en az 1 kez yapilmali ve raporlanmalidir.
- Tatbikat proseduru: `docs/backup-restore-tatbikat.md`.

## 6) Guvenlik Baslangic Ceklisti

- `AI_GATEWAY_SHARED_SECRET` guclu bir deger ile set edilmeli.
- `FLASK_DEBUG=0` zorunlu olmali.
- Uretimde HTTPS/TLS sonlandirma aktif olmali.
- CORS sadece yetkili origin'lere acik olmali.
- Session secret ve tum API anahtarlari secret manager'dan alinmali.

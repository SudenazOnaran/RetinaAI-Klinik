# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Operasyon Dokumanlari

- On-prem / VPC kurulum ve SLA paketi: `docs/onprem-vpc-sla-paketi.md`
- Operasyon runbook: `docs/operasyon-runbook.md`
- Env fail-fast matrix: `docs/env-fail-fast-matrix.md`
- Backup/restore tatbikat proseduru: `docs/backup-restore-tatbikat.md`
- Ornek ortam dosyalari: `.env.example`, `.env.onprem.example`, `.env.vpc.example`
- Release gate komutu: `npm run release:check`
- Deployment/SLA API: `GET /api/doctor/monitoring/deployment-profile`
- Pilot metrik export: `GET /api/doctor/pilot-metrics?format=csv`
- Aylik snapshot cron endpoint: `POST /api/cron/pilot-metrics-snapshot` (`Authorization: Bearer $PILOT_METRICS_CRON_SECRET`)

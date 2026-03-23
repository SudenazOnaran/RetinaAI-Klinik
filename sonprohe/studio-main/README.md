# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Operasyon Dokumanlari

- On-prem / VPC kurulum ve SLA paketi: `docs/onprem-vpc-sla-paketi.md`
- Ornek ortam dosyalari: `.env.onprem.example`, `.env.vpc.example`
- Deployment/SLA API: `GET /api/doctor/monitoring/deployment-profile`
- Pilot metrik export: `GET /api/doctor/pilot-metrics?format=csv`
- Aylik snapshot cron endpoint: `POST /api/cron/pilot-metrics-snapshot` (`Authorization: Bearer $PILOT_METRICS_CRON_SECRET`)

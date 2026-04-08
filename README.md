# Retina AI

Bu repo web uygulamasi ve AI servisinin birlikte yonetildigi monorepo yapisindadir.

## Klasor Yapisi

- `apps/web`: Next.js tabanli web uygulamasi
- `services/ai`: Flask + PyTorch AI tahmin servisi

## Hizli Baslangic

### 1) Web

```bash
npm run web:install
npm run web:dev
```

### 2) AI Servisi

```bash
python -m venv services/ai/.venv
services/ai/.venv/Scripts/pip install -r services/ai/requirements.txt
copy services/ai/.env.example services/ai/.env
npm run ai:run
```

## Ortam Degiskenleri

- Web tarafi ornegi: `apps/web/.env.example`
- AI tarafi ornegi: `services/ai/.env.example`

## GitHub Notlari

- Gizli anahtarlar ve `.env` dosyalari repoya dahil edilmez.
- AI model agirliklari (`services/ai/models/`, `*.pth`) repoya dahil edilmez.
- Build ciktilari ve `node_modules` repoya dahil edilmez.

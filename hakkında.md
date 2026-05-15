# Hakkında: Retina AI Projesi

Bu dosya, **Retina AI** monoreposunun amacı, mimarisi, işlevleri ve kullanılan teknolojiler için özet bir referanstır. Detay için kök `README.md`, `apps/web/README.md`, `services/ai/README.md` ve `docs/` altındaki dokümanlara bakınız.

---

## Proje ne işe yarar?

**Retina AI**, göz hekimleri için klinik bir **fundus / OCT / FFA** analiz ve raporlama platformudur. Tek depoda iki ana parça birlikte yönetilir:

| Bileşen | Konum | Rol |
|--------|--------|-----|
| **Web uygulaması** | `apps/web` | Oturum, hasta, analiz, rapor, KVKK, takvim, izleme, eğitim verisi export |
| **AI servisi** | `services/ai` | Görüntü üzerinde tahmin (PyTorch DenseNet ve/veya Google Gemini), HTTP API |

Üst çalışma alanında (`retinai` klasörü) ayrıca statik **tanıtım sitesi** (`tanitim-sitesi`) bulunabilir; Next.js uygulamasının kök sayfası (`apps/web`) yapılandırmaya göre bu tür bir tanıtım adresine yönlendirilebilir.

---

## Monorepo yapısı

- **`apps/web`**: Next.js tabanlı web uygulaması (klinik panel, API route’ları, Prisma).
- **`services/ai`**: Flask + PyTorch (+ isteğe bağlı Gemini) AI servisi.
- **`docs/`**: Canlı deploy, eğitim veri seti girişleri vb. Türkçe/teknik notlar.

Kök `package.json` örnek komutlar: `web:install`, `web:dev`, `web:build`, `ai:run` → `python services/ai/app.py`.

---

## Web uygulaması — işlevler

- **Hekim iş akışı:** Giriş ve kayıt, hasta listesi ve detay, analiz ekranı, geçmiş, raporlar, profil, ayarlar, takvim, entegrasyonlar, admin ve izleme sayfaları (`src/app/dashboard/...`, `src/app/login`, vb.).
- **AI analiz uçları (Next.js API):**
  - `/api/ai/predict` — fundus
  - `/api/ai/predict-oct` — maküler OCT
  - `/api/ai/predict-ffa` — FFA  
  İstekler oturum doğrulamasından sonra `ai-gateway` ile Flask servisine iletilir; hata durumunda kuyruk (`AiRequestQueue`) ve izleme uyarıları devreye girebilir.
- **Raporlama:** Yapısal rapor alanları (Prisma `Analysis` modeli), PDF üretimi (`/api/doctor/report/pdf`).
- **Eğitim / veri seti:** Doktor geri bildirimi; `TrainingDatasetEntry`, OCT ve FFA eğitim satırları; export ve backfill script’leri (`apps/web/package.json` içindeki `export:training-dataset*`, `backfill:*` komutları). Ayrıntı: `docs/TRAINING-DATASET-ENTRY.tr.md`.
- **Uyumluluk ve operasyon:** KVKK onay ve işleme logları, denetim (`AuditLog`), pilot metrikleri ve cron snapshot, deployment profili, sağlık endpoint’leri.
- **Kök sayfa:** `src/app/page.tsx` — uygulama kökü tanıtım sitesine yönlendirilir (`MARKETING_ORIGIN` veya üretimde yapılandırılan adres).

---

## Web — kullanılan teknolojiler

- **Çatı:** Next.js 15 (App Router, `src/app`), React 19, TypeScript; geliştirme genelde Turbopack ve özel port (ör. 9002).
- **Stil / UI:** Tailwind CSS, Radix UI bileşenleri, shadcn tarzı yapı (`components.json`), lucide-react, sonner, recharts.
- **Form / doğrulama:** react-hook-form, @hookform/resolvers, zod.
- **Veritabanı:** PostgreSQL + Prisma 6 (`Doctor`, `Patient`, `Analysis`, eğitim tabloları, AI kuyruğu, KVKK, pilot metrikleri, vb.).
- **Kimlik / güvenlik:** Oturum yönetimi, bcryptjs, giriş denemesi kilidi; AI çağrılarında paylaşımlı sırrın web ve AI servisinde aynı olması (`AI_GATEWAY_SHARED_SECRET`); isteklerde `x-request-id` (middleware).
- **Depolama / yedek:** Object storage ve yedekleme/restore ile ilgili API route’ları.
- **E-posta:** nodemailer.
- **Firebase:** `firebase` paketi; `apphosting.yaml` ile Firebase App Hosting yapılandırması.
- **Google AI (web):** Genkit + `@genkit-ai/google-genai` — örnek yapılandırma `src/ai/genkit.ts` (ör. `gemini-2.5-flash`).
- **PDF / tarayıcı otomasyonu:** jspdf, jspdf-autotable, puppeteer (bağımlılıklarda tanımlı).
- **Test / kalite:** Vitest, Playwright (e2e), ESLint; `npm run release:check` (lint, typecheck, unit, e2e, build).
- **CI:** `.github/workflows/ci.yml` — `apps/web` altında release gate ve Playwright.

---

## AI servisi — işlev ve teknolojiler

- **`app.py`** (kökten `npm run ai:run`): Flask, Flask-CORS, PyTorch + torchvision (DenseNet tabanlı DR sınıflandırma), OpenCV, NumPy, Pillow.
- **Açıklanabilirlik / güven:** Grad-CAM++ benzeri ısı haritası; isteğe bağlı ROI maskesi ile lokalizasyon metrikleri (IoU, Dice vb.); MC dropout ile belirsizlik; OOD (dağılım dışı) sinyalleri.
- **Güvenlik / ölçek:** `X-AI-Gateway-Key` ile yetkilendirme; IP başına rate limit (bellek veya Redis script’i).
- **`app_gemini.py`:** Google Genai (Gemini) ile `/predict`; çoklu API anahtarı, görüntü boyutu sınırı; isteğe bağlı yerel multitask modeli; DenseNet yedek ve Grad-CAM entegrasyonu (dosya başlığı ve `services/ai/README.md`).
- **Bağımlılıklar:** `requirements.txt` — flask, flask-cors, python-dotenv, numpy, opencv-python, pillow, torch, torchvision, redis, google-genai.
- **Modeller:** `services/ai/models/` altında `model.pth` / `model.pt` (depoda yok; canlı ortamda ayrı dağıtım). `.gitignore` ile ağırlık ve gizli dosyalar repodan hariç tutulur.

---

## Ortam ve dağıtım

- Örnek ortam dosyaları: `apps/web/.env.example`, `services/ai/.env.example` (ve gerektiğinde `.env.local`).
- Canlı kontrol listesi: `docs/CANLI-DEPLOY.tr.md` (PostgreSQL / Prisma migrate, object storage, web→AI URL’leri, Gemini vs DenseNet, bilinen riskler).

---

## Özet cümle

**Retina AI**, PostgreSQL ve Prisma ile klinik veriyi kalıcı tutan, Next.js ile hekim paneli sunan; fundus, OCT ve FFA analizlerini güvenli bir AI geçidi üzerinden Flask + PyTorch ve isteğe bağlı Gemini servislerine bağlayan; raporlama, KVKK, denetim, kuyruk, pilot metrikleri ve eğitim verisi export’u ile üretim odaklı yapılandırılmış bir monorepodur.

---

*Bu dosya proje özeti içindir; API sözleşmeleri ve şema ayrıntıları için kaynak kod ve `prisma/schema.prisma` esas alınmalıdır.*

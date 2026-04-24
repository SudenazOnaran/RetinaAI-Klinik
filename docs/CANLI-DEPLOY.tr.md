# Canlı ortam ve GitHub — kontrol listesi

Bu doküman, son değişikliklerden sonra **GitHub’a push** ve **canlı (production)** için yapılacakları özetler.

## 1. Push öncesi (yerelde)

- **Gizli bilgi:** `.env`, `.env.local`, API anahtarları, `storage/objects/` commit edilmemeli. Kök `.gitignore` ve `apps/web/.gitignore` buna göre ayarlı; yine de `git status` ile kontrol edin.
- **Eğitim / export çöplüğü:** `apps/web/exports/` ve `services/ai/training_out/` artık ignore listesinde; yanlışlıkla eklenmişse `git rm -r --cached` ile çıkarın.
- **Prisma:** `apps/web/prisma/migrations/` altındaki tüm klasörler + `migration_lock.toml` repoda olmalı.
- **Doğrulama (isteğe bağlı):**
  - `cd apps/web && npx prisma validate`
  - `cd apps/web && npm run build` (veya CI’deki build komutu)
  - `cd services/ai && python -m py_compile app.py app_gemini.py dr_gradcam_heatmap.py densenet_dr_fallback.py`

## 2. PostgreSQL (canlı veritabanı)

1. **`DATABASE_URL`** canlı ortam değişkeninde doğru bağlantı dizesi olsun.
2. Deploy sırasında veya hemen sonra:
   - Tercihen: `cd apps/web && npx prisma migrate deploy`
   - Geçmişte “boş DB + migrate history yok” (P3005) senaryosu yaşandıysa: boş DB’de migrate zinciri tercih edilir; mevcut üretim DB’si için DBA ile **baseline** veya eksik sütunlar için tek seferlik SQL uygulaması gerekebilir.
3. Yeni sütunlar özeti: `TrainingDatasetEntry` (`drFeedback`, `doctorNotesText`, `doctorNote`, ML sütunları vb.), `Analysis` alanları — şema `schema.prisma` ile uyumlu olmalı.

## 3. Next.js web (`apps/web`)

- Ortam değişkenleri: en az **`DATABASE_URL`**, **`AI_GATEWAY_SHARED_SECRET`** (web ile AI servisi **aynı** paylaşımlı sır), AI taban URL’si (aşağıda).
- Deploy sonrası: `npx prisma generate` genelde build içinde veya postinstall’da çalışır; client üretimi eksikse build hata verir.
- **Object storage:** `apps/web/storage/objects/` canlıda kalıcı disk veya S3 benzeri çözümle eşlenmeli; yoksa yüklenen görüntüler kaybolur.

## 4. AI servisi (`services/ai`)

- **Gemini kullanımı:** `python app_gemini.py` (veya süreç yöneticinizle aynı komut).
- **Ortam (örnek):**
  - `AI_GATEWAY_SHARED_SECRET` — web ile aynı
  - `GEMINI_API_KEY`, isteğe bağlı `GEMINI_API_KEY_2` veya `GEMINI_API_KEYS`
  - `GEMINI_MODEL`, `GEMINI_DR_HEATMAP` (isteğe bağlı)
  - DenseNet yedek / `app.py` için: `models/model.pth` veya `models/model.pt` sunucuda `services/ai/models/` altında **veya** `DR_DENSENET_WEIGHTS` ile tam yol
- **Firewall / reverse proxy:** Web uygulamasının AI’ye gideceği host:port açık olmalı (ör. iç ağda `http://ai:5001`).

## 5. Web → AI yönlendirmesi

- `apps/web` içindeki predict route / env (ör. `AI_SERVICE_URL`, `AI_GEMINI_URL` — projedeki gerçek isimlere bakın) **canlı AI adresini** göstermeli.
- Yerelde Gemini portu 5001 ise, canlıda da aynı mantıkla URL güncellenmeli.

## 6. İlk canlı kontroller

1. Giriş + hasta listesi açılıyor mu?
2. Fundus yükleyip analiz: Gemini veya yedek model cevap dönüyor mu?
3. Rapor kaydı: `TrainingDatasetEntry` oluşuyor mu, hata toast’ı yok mu?
4. Gerekirse: `npm run backfill:training-entry-features` **sadece** eski satırları güncellemek için (production DB’de yedek aldıktan sonra).

## 7. Bilinen riskler / hatırlatmalar

- **Model dosyası repoda yok:** `.gitignore` `services/ai/models/` ve `*.pth` içerir; canlıda ağırlıkları ayrı dağıtın.
- **Çoklu Gemini anahtarı:** kota dolunca sırayla denenir; tümü biterse DenseNet yedek devreye girer (ağırlık dosyası şart).
- **Prisma migrate vs. manuel SQL:** Eski DB’lerde migration geçmişi yoksa `migrate deploy` tek başına yetmeyebilir; üretimde DBA süreci tanımlı olsun.

---

*Son güncelleme: repo içi şema ve AI yedek zinciri ile uyumlu olacak şekilde yazılmıştır.*

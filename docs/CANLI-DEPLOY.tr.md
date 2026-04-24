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

## 8. Sunucuda kod çekildi; mevcut veriyi silmeden güncelleme

Amaç: **PostgreSQL’deki hastalar, analizler, kullanıcılar** korunur; yalnızca şema yeni koda uyarlanır. Yine de **tam yedek** şartsız ilerlemeyin.

### 8.1 Yedek (zorunlu)

Sunucuda (veya DB host’ta), güncellemeden hemen önce:

```bash
# Örnek: tüm veritabanı, sıkıştırılmış
pg_dump "$DATABASE_URL" -Fc -f "retina_backup_$(date +%Y%m%d_%H%M).dump"

# veya bağlantı parametreleriyle
pg_dump -h HOST -U USER -d DBNAME -Fc -f retina_backup.dump
```

İsteğe bağlı: aynı anda satır sayısı notu (`SELECT COUNT(*) FROM "Patient";` vb.).

**Dosya depolama:** `apps/web/storage/objects/` altındaki görüntüler Git’te değilse, sunucuda bu klasörü de yedekleyin veya snapshot alın; kod güncellemesi bu dosyaları tek başına silmez ama yanlış deploy path riskine karşı yedek iyi olur.

### 8.2 Uygulamayı kısa süre durdurma (önerilir)

Migration sırasında yazma trafiği olmasın diye web (ve mümkünse AI) süreçlerini durdurup, migration bitince açmak en güvenlisi.

### 8.3 Prisma migration

Proje kökünde `apps/web`:

```bash
cd apps/web
npx prisma migrate deploy
```

- **Başarılı:** `_prisma_migrations` tablosu güncellenir, şema yeni migration’larla uyumlu olur.
- **`P3005` (DB boş değil ama migrate geçmişi yok / uyumsuz):** Üretim DB’sinde daha önce manuel veya karışık SQL uygulandıysa Prisma reddedebilir. Seçenekler:
  1. DBA ile **baseline**: Mevcut şemanın hangi migration’a denk geldiği işaretlenir (`prisma migrate resolve`), sonra kalanlar uygulanır.
  2. Veya eksik sütunlar için yalnızca gerekli `migration.sql` dosyalarını sırayla `prisma db execute --schema prisma/schema.prisma --file ...` ile uygulayıp, ardından geçmişi uzmanla hizalamak.

Yerelde kullandığınız **tamamlayıcı / idempotent** SQL’ler (`ADD COLUMN IF NOT EXISTS`, `DROP COLUMN IF EXISTS`) üretimde de satır kaybı yapmaz; ancak **DROP COLUMN** çalışırsa o sütundaki veri gider. Bu projede eski `TrainingDatasetEntry` sütunları kaldırılırken, aynı bilginin büyük kısmı **`Analysis`** satırında duruyor olmalı; yine de kritik sütunları DB’de kontrol edin.

### 8.4 Deploy sonrası

```bash
cd apps/web
npx prisma generate
npm run build   # veya platformunuzun build adımı
```

Eski `TrainingDatasetEntry` satırlarında yeni ML / `doctorNote` alanları boşsa (sadece **yeni alanlar**, satır silinmez):

```bash
cd apps/web
npm run backfill:training-entry-features
```

(Önce yedek; script sadece ilgili tabloda `UPDATE` yapar.)

### 8.5 Doğrulama

- Giriş, hasta listesi, son analiz kayıtları görünüyor mu?
- Rapor kaydı hatasız mı?
- İsteğe bağlı: `SELECT COUNT(*) FROM "Analysis";` önce/sonra (aynı kalmalı; migration satır silmez, yalnızca şema değiştirir).

### 8.6 Geri dönüş

Sorun çıkarsa uygulamayı kapatıp **yedek dump** ile veritabanını geri yükleyin (`pg_restore`), ardından kodu önceki commit’e alın.

---

## 9. Terminalde adım adım (üretim sunucusu, Bash)

Aşağıdaki yolları kendi sunucuna göre değiştir: `RETINA_ROOT`, Git branch, process yöneticisi (`pm2` / `systemd` / Docker).

### Adım 0 — Bağlan ve proje kökünü ayarla

```bash
# Örnek: SSH (kendi kullanıcı ve host ile)
ssh kullanici@sunucu-ip

# Proje bu repoysa (klasör adını kendi kurulumuna göre düzenle)
export RETINA_ROOT="$HOME/retinai/retina_ai"
cd "$RETINA_ROOT" || exit 1
pwd
git status
```

### Adım 1 — Güncel kodu çek

```bash
cd "$RETINA_ROOT"
git fetch origin
git checkout main
git pull origin main
```

(Branch adın `master` ise `main` yerine `master` kullan.)

### Adım 2 — Ortam dosyası

Web uygulaması `apps/web` içinde `DATABASE_URL` vb. okur. `.env` dosyan **sunucuda zaten varsa** dokunma; yoksa `.env.example` üzerinden oluşturup düzenle:

```bash
cd "$RETINA_ROOT/apps/web"
test -f .env && echo ".env mevcut" || echo "UYARI: .env yok, oluşturman gerekir"
# Gerekirse (örnek, değerleri doldur):
# cp .env.example .env && nano .env
```

**Not:** `DATABASE_URL` içinde özel karakter varsa URL-encode edilmiş olmalı.

### Adım 3 — Yedek klasörü ve veritabanı dump’ı

```bash
mkdir -p "$RETINA_ROOT/backups"
STAMP=$(date +%Y%m%d_%H%M)
DUMP_FILE="$RETINA_ROOT/backups/retina_db_${STAMP}.dump"

# DATABASE_URL ortamında tanımlıysa (önerilen: apps/web/.env içinden export)
set -a
# .env satırlarını shell'e yükle (yorum satırları atlanır; basit projeler için)
grep -v '^#' "$RETINA_ROOT/apps/web/.env" | grep -v '^$' > /tmp/retina_web_env.sh
source /tmp/retina_web_env.sh
set +a

pg_dump "$DATABASE_URL" -Fc -f "$DUMP_FILE"
echo "Yedek: $DUMP_FILE"
ls -lh "$DUMP_FILE"
```

`DATABASE_URL` shell’de yoksa, elle:

```bash
pg_dump -h PG_HOST -p 5432 -U PG_USER -d PG_DBNAME -Fc -f "$DUMP_FILE"
```

### Adım 4 — (İsteğe bağlı) Satır sayıları notu

```bash
psql "$DATABASE_URL" -c 'SELECT COUNT(*) AS patients FROM "Patient";'
psql "$DATABASE_URL" -c 'SELECT COUNT(*) AS analyses FROM "Analysis";'
psql "$DATABASE_URL" -c 'SELECT COUNT(*) AS training_rows FROM "TrainingDatasetEntry";'
```

### Adım 5 — (İsteğe bağlı) Yüklenen görüntü klasörü yedeği

```bash
STORAGE="$RETINA_ROOT/apps/web/storage/objects"
if [ -d "$STORAGE" ]; then
  tar czf "$RETINA_ROOT/backups/storage_objects_${STAMP}.tar.gz" -C "$RETINA_ROOT/apps/web/storage" objects
  ls -lh "$RETINA_ROOT/backups/storage_objects_${STAMP}.tar.gz"
else
  echo "storage/objects yok veya başka yolda; atlandı"
fi
```

### Adım 6 — Uygulamayı durdur (yazma trafiğini kes)

Örnek **PM2**:

```bash
pm2 stop all
# veya sadece web: pm2 stop retina-web
```

Örnek **systemd**:

```bash
sudo systemctl stop retina-web.service
```

Docker kullanıyorsan ilgili container’ları durdur.

### Adım 7 — Bağımlılıklar ve Prisma migration

```bash
cd "$RETINA_ROOT/apps/web"
npm ci
# veya: npm install

npx prisma migrate deploy
```

**Başarılı çıktı:** Uygulanan migration’ların listesi, hata yok.

**`P3005` veya “migration history” hatası:** Bu dokümanın §8.3; tek başına tekrar `migrate deploy` çözmeyebilir. O durumda yedekle birlikte DBA / geliştirici ile baseline veya `prisma db execute` ile hedefli SQL.

### Adım 8 — Prisma client ve build

```bash
cd "$RETINA_ROOT/apps/web"
npx prisma generate
npm run build
```

Build hatasında migration’a dönme; logu düzelt, gerekirse önceki kod + `pg_restore` düşün.

### Adım 9 — (İsteğe bağlı) Eğitim satırı backfill

Sadece `TrainingDatasetEntry` üzerinde **UPDATE**; yeni satır silmez.

```bash
cd "$RETINA_ROOT/apps/web"
npm run backfill:training-entry-features
```

### Adım 10 — Uygulamayı başlat

```bash
pm2 start all
# veya: pm2 restart retina-web
# systemd: sudo systemctl start retina-web.service
```

### Adım 11 — Doğrulama (terminal)

```bash
psql "$DATABASE_URL" -c 'SELECT COUNT(*) AS analyses FROM "Analysis";'
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/
```

Port ve host’u kendi reverse proxy’ne göre değiştir. Tarayıcıdan giriş, hasta açma, rapor kaydı dene.

### Adım 12 — Sorun çıkarsa geri yükleme (özet)

```bash
# Uygulamayı durdur, sonra (örnek):
pg_restore --clean --if-exists -d "$DATABASE_URL" "$DUMP_FILE"
# veya hedef DB boşaltılıp yeniden oluşturuluyorsa DBA prosedürüne uy
```

`--clean` üretimde risklidir; **mutlaka** yedek dosya yolunu ve hedef DB’yi doğrula.

---

### Windows sunucu (PowerShell) notu

`pg_dump` / `psql` PATH’te olmalı. `DATABASE_URL`’i `apps/web/.env` içinden kopyalayıp geçici ortam değişkeni yapabilirsin; `npm`, `npx` adımları `apps/web` içinde aynıdır. `export` yerine `$env:DATABASE_URL = "..."` kullan.

---

*Son güncelleme: repo içi şema ve AI yedek zinciri ile uyumlu olacak şekilde yazılmıştır.*

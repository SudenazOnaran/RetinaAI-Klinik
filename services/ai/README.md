# AI Service

Bu klasor Retina AI Flask servisinin calistigi alandir.

## Kurulum

1. Python sanal ortam olustur:
   - Windows PowerShell: `python -m venv .venv`
2. Sanal ortami aktif et:
   - Windows PowerShell: `.venv\Scripts\Activate.ps1`
3. Bagimliliklari kur:
   - `pip install -r requirements.txt`
4. Ortam dosyasini olustur:
   - `.env.example` kopyasini `.env` yap ve degerleri doldur.

## Calistirma

- Proje kokunden:
  - `npm run ai:run` → `app.py` (DenseNet, varsayilan port `AI_PORT`)
- Gemini + yedek DenseNet:
  - Bu klasorden: `python app_gemini.py` (port `AI_GEMINI_PORT`, varsayilan 5001)

## Notlar

- Model agirliklari `models/` altinda: `model.pth` veya `model.pt` (veya `DR_DENSENET_WEIGHTS` ile tam yol).
- `models/` Git’e dahil degildir; canlida sunucuya ayri kopyalayin.

## VPS (retina-ai.tech) — “AI servisine erişilemiyor”

Web (Next.js, port 3000) analizi **aynı makinedeki** `app_gemini.py` (port **5001**) üzerinden çağırır. Nginx dış dünyaya 3000’i açar; 5001 yalnızca localhost’tur.

### 1) Sunucuda kontrol (SSH)

```bash
curl -s http://127.0.0.1:5001/health
ss -tlnp | grep 5001
```

`connection refused` → Gemini servisi çalışmıyor.

### 2) Web `.env` (production)

`apps/web/.env` veya process env:

```env
AI_SERVICE_URL=http://127.0.0.1:5001/predict
AI_GATEWAY_SHARED_SECRET=<web ile aynı gizli değer>
AI_REQUEST_TIMEOUT_MS=120000
```

`AI_SERVICE_URL` **5000** (`app.py`) iken OCT/FFA **5000/predict-oct** adresine giderse **404** alırsınız (app.py bu yolları sunmaz). Web gateway artık fundus 5000 iken OCT/FFA’yı otomatik **5001**’e yönlendirir; yine de `retinai-gemini-ai` ayakta olmalıdır.

**Sadece fundus çalışıyor, OCT/FFA “AI servisine erişilemiyor”** → tipik tablo:

| Servis | Port | Endpoint |
|--------|------|----------|
| `retina-ai` (Gunicorn, `app.py`) | 5000 | `/predict` ✅ fundus |
| `retinai-gemini-ai` (`app_gemini.py`) | 5001 | `/predict-oct`, `/predict-ffa` ✅ |

Kontrol: `curl -s http://127.0.0.1:5001/health` ve `curl -s -o /dev/null -w "%{http_code}" -H "X-AI-Gateway-Key: SECRET" -F locale=tr http://127.0.0.1:5001/predict-oct` (400 = endpoint var).

### 3) AI `.env.local` (`services/ai/.env.local`)

```env
GEMINI_API_KEY=...
AI_GATEWAY_SHARED_SECRET=<web ile birebir aynı>
AI_GEMINI_PORT=5001
```

### 4) Sürekli çalıştırma

Örnek unit: `deploy/retinai-gemini-ai.service.example` → `/etc/systemd/system/retinai-gemini-ai.service`

```bash
sudo systemctl enable --now retinai-gemini-ai
sudo systemctl status retinai-gemini-ai
journalctl -u retinai-gemini-ai -n 50 --no-pager
```

Deploy sonrası kodu güncellediyseniz: `sudo systemctl restart retinai-gemini-ai` ve `systemctl restart` (Next.js servisiniz).

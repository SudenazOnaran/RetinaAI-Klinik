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

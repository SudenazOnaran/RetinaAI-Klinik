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
  - `npm run ai:run`
- Veya bu klasorden:
  - `python app.py`

## Notlar

- Model agirliklari `models/` altinda beklenir.
- `models/` klasoru GitHub'a dahil edilmez; deploy ortamina ayri olarak kopyalanmalidir.

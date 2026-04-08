# **App Name**: Retina AI

## Core Features:

- Hasta Listesi Yönetimi: Hasta listesini görüntüleme, filtreleme ve arama. TC Kimlik No ile arama, yaş aralığı, risk seviyesi ve son ziyaret tarihine göre filtreleme seçenekleri.
- Hasta Detay Görüntüleme: Hasta profil bilgilerini (Ad Soyad, Hasta ID, Yaş, Cinsiyet, Diyabet Süresi, Son HB1Ac değeri, Risk seviyesi) ve tıbbi geçmişini (önceki tedaviler, ilaçlar, notlar) görüntüleme.
- Fundus Görüntüsü Yükleme: Fundus görüntülerini yükleme ve önizleme. Sürükle-bırak ve dosya seçme seçenekleri. API endpoint örneği: `fetch('/api/upload', ...)`
- AI Görüntü Analizi: Yüklenen fundus görüntülerini analiz ederek hastalık sınıflandırması (Yok, Hafif, Orta, Ciddi, Proliferatif) ve güven skorunu belirleme. Model sonuçları JSON formatında: `{ "label": "Orta", "confidence": 0.87, "explanation": "..." }`
- XAI ile Açıklanabilirlik: Modelin kararını açıklayan kısa bir özet (1-2 cümle) sunma ve XAI ısı haritası (Grad-CAM/SHAP benzeri) ile lezyon bölgelerini görselleştirme. Bu özellik bir tool olarak, LLM'in muhakeme yeteneği sayesinde kararlarını açıklamasını sağlar.
- Geçmiş Muayene Kayıtları: Hastaya ait geçmiş muayene kayıtlarını tarih, küçük önizleme görüntüsü, model sonucu, doktor notu ve risk seviyesi ile birlikte görüntüleme. Zaman çizelgesi görünümü.
- Doktor Notu ve Onay: Her analiz için doktor notu ekleme ve sonucu onaylama/düzenleme. Onay/Ret bilgisini MSSQL veritabanına kaydetme.

## Style Guidelines:

- Ana renk: Açık mavi (#E3F2FD), tıbbi ve temiz bir görünüm için.
- Arka plan rengi: Çok açık mavi (#F8FAFC), hafifçe doygunluğu azaltılmış, böylece ana renkle görsel uyum sağlanır ve rahat bir görünüm sunar.
- Vurgu rengi: Koyu mavi (#1976D2), butonlar ve önemli detaylar için dikkat çekici bir kontrast oluşturur.
- Font: 'Inter', sans-serif, modern ve okunabilir bir yazı tipi hem başlıklar hem de metinler için uygundur.
- Temiz medikal tasarım, beyaz + mavi renk paleti, kart tabanlı düzen, yumuşak yuvarlatılmış köşeler (border-radius ~12-16px), hafif gölgeler.
- Menü öğeleri için basit ve anlaşılır ikonlar.
- Hafif animasyonlar ve geçişler, özellikle veri yükleme ve analiz sonuçlarının gösterilmesi sırasında.
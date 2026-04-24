# Hakkında: Retina AI Projesi

Bu dosya, Retina AI projesinin genel yapısını ve temel özelliklerini hızlıca anlamak isteyenler için hazırlanmıştır.

## Genel Bakış

Retina AI, sağlık ve yapay zeka odaklı bir projedir. Proje, çoklu uygulama ve servislerden oluşan bir monorepo yapısına sahiptir. Hem web tabanlı kullanıcı arayüzü hem de arka planda çalışan AI servisleri içerir.

## Ana Klasörler ve İçerikleri

### 1. apps/

- **web/**: Next.js tabanlı modern bir web uygulamasıdır.
  - `src/`: Uygulama kaynak kodları (bileşenler, sayfalar, hook'lar, yardımcı kütüphaneler)
  - `prisma/`: Veritabanı şeması ve migration dosyaları (Prisma ORM)
  - `e2e/`: Playwright ve Vitest ile yazılmış uçtan uca testler
  - `docs/`: Proje dokümantasyonları ve operasyonel rehberler
  - `scripts/`: Yardımcı scriptler (env kontrolü, temizlik, analiz düzeltme vb.)
  - `package.json`, `tsconfig.json`, `tailwind.config.ts`: Yapılandırma dosyaları

### 2. services/

- **ai/**: Python ile yazılmış yapay zeka servisleri ve modelleri.
  - `app.py`: Klasik DenseNet `/predict` servisi; `app_gemini.py`: Gemini + çoklu anahtar + DenseNet yedek
  - `training/`: Eğitim scriptleri (multitask, DR sınıflandırıcı); `models/`: Ağırlık dosyaları (depoda yok, deploy’da kopyalanır)
  - `requirements.txt`: Python bağımlılıkları

### 3. tanitim-sitesi/

- Projenin tanıtım ve bilgilendirme sitesi (statik HTML, JS, CSS)
- Kullanım koşulları, gizlilik, KVKK gibi yasal dokümanlar

### 4. images/

- Görsel ve medya dosyaları

## Temel Özellikler

- **Monorepo**: Tüm uygulama ve servisler tek bir depo altında yönetilir.
- **Next.js Web Uygulaması**: Modern, ölçeklenebilir ve test edilebilir frontend.
- **AI Servisleri**: Python tabanlı, model eğitimi ve tahmin servisleri.
- **Prisma ORM**: Tip güvenli veritabanı işlemleri.
- **E2E Testler**: Playwright ve Vitest ile otomasyon testleri.
- **Dokümantasyon**: Operasyon, uyumluluk ve teknik dökümantasyonlar.

## Kullanım Senaryoları

- Sağlık verilerinin analiz edilmesi ve raporlanması
- AI tabanlı görüntü işleme ve tahmin
- Klinik ve regülasyon uyumluluğu

## Başlangıç

- Web uygulaması ve AI servisleri için ilgili klasörlerdeki README.md dosyalarını inceleyin.
- Geliştirme ve kurulum için `package.json` ve `requirements.txt` dosyalarına bakabilirsiniz.

---

Bu dosya, projenin genel yapısını ve önemli noktalarını özetler. Detaylı bilgi için ilgili alt klasörlerdeki README ve dokümantasyon dosyalarını inceleyiniz.

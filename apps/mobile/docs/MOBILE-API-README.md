# Mobil Uygulama API - Hızlı Başlangıç

## 🚀 Kurulum ve Çalıştırma

### 1. API'yi Çalıştırma

API Next.js projesi içinde zaten hazır. Web uygulamasını çalıştırdığınızda API otomatik olarak aktif olur:

```bash
cd apps/web
npm install
npm run dev
```

API şu adreste çalışacaktır: `http://localhost:9002/api/mobile/v1`

### 2. Test Etme (cURL)

#### Login
```bash
curl -X POST http://localhost:9002/api/mobile/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "password": "your_password"
  }'
```

#### Hastaları Listele
```bash
curl http://localhost:9002/api/mobile/v1/patients \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Hasta Ekle
```bash
curl -X POST http://localhost:9002/api/mobile/v1/patients \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Hasta",
    "tcNo": "12345678901",
    "age": 45,
    "gender": "Erkek",
    "risk": "Orta"
  }'
```

### 3. Test Etme (Postman)

1. Postman'i açın
2. Yeni Collection oluşturun: "RetinaAI Mobile API"
3. Environment değişkenleri ekleyin:
   - `baseUrl`: `http://localhost:9002`
   - `token`: `(login sonrası doldurulacak)`

4. İstekleri ekleyin:
   - **Login**: `POST {{baseUrl}}/api/mobile/v1/auth/login`
   - **Get Patients**: `GET {{baseUrl}}/api/mobile/v1/patients`
   - **Create Patient**: `POST {{baseUrl}}/api/mobile/v1/patients`

## 📚 Endpoint Özeti

### Auth
- `POST /api/mobile/v1/auth/login` - Giriş yap
- `POST /api/mobile/v1/auth/verify` - Token doğrula

### Patients
- `GET /api/mobile/v1/patients` - Hastaları listele
- `POST /api/mobile/v1/patients` - Hasta ekle / batch sync
- `GET /api/mobile/v1/patients/{id}` - Hasta detayı
- `PATCH /api/mobile/v1/patients/{id}` - Hasta güncelle
- `DELETE /api/mobile/v1/patients/{id}` - Hasta sil

### Analyses
- `GET /api/mobile/v1/analyses` - Analizleri listele
- `POST /api/mobile/v1/analyses` - Analiz ekle / batch sync
- `GET /api/mobile/v1/analyses/{id}` - Analiz detayı
- `PATCH /api/mobile/v1/analyses/{id}` - Analiz güncelle
- `DELETE /api/mobile/v1/analyses/{id}` - Analiz sil

### Sync
- `POST /api/mobile/v1/sync` - Toplu senkronizasyon
- `GET /api/mobile/v1/sync` - Sync durumu

## 🔑 API Key Kullanımı

Her istekte Authorization header'ı göndermeniz gerekir:

```
Authorization: Bearer <token>
```

## 📖 Detaylı Dokümantasyon

Tüm detaylar için bakınız: [MOBILE-API-ENTEGRASYON.md](./MOBILE-API-ENTEGRASYON.md)

## 🛠️ Mobil Uygulama Geliştiricisi İçin

### Gerekli Adımlar

1. **API Base URL'i ayarlayın**
   ```dart
   static const String baseUrl = 'https://your-production-domain.com';
   ```

2. **Yerel veritabanı oluşturun** (SQLite/Hive/Isar)
   - Patients tablosu
   - Analyses tablosu

3. **Offline-First stratejisi uygulayın**
   - Offline ID oluşturma: `offline_<uuid>`
   - Sync mekanizması
   - Conflict resolution

4. **Token yönetimi**
   - Flutter Secure Storage kullanın
   - Token expiry kontrolü
   - Auto-refresh

5. **Background Sync**
   - Connectivity kontrolü
   - Periyodik sync (WorkManager)
   - Retry mekanizması

### Örnek Kod (Flutter)

Detaylı Flutter entegrasyon kodları için [MOBILE-API-ENTEGRASYON.md](./MOBILE-API-ENTEGRASYON.md) dosyasına bakınız.

## 🐛 Hata Ayıklama

### API yanıt vermiyor
1. Web uygulamasının çalıştığından emin olun: `npm run dev`
2. Port kontrolü: `9002` portu açık mı?
3. CORS hatası varsa middleware'i kontrol edin

### Token geçersiz
1. Token'ın doğru gönderildiğinden emin olun
2. Bearer prefix'i kontrol edin
3. Token süresi dolmuş olabilir, yeniden login yapın

### Senkronizasyon çalışmıyor
1. İnternet bağlantısını kontrol edin
2. Offline ID formatını kontrol edin: `offline_<uuid>`
3. API response'u logla ve hataları incele

## 📞 Destek

Sorularınız için:
- Email: support@retinaai-klinik.com
- Docs: [MOBILE-API-ENTEGRASYON.md](./MOBILE-API-ENTEGRASYON.md)

---

**Not**: Bu API production ortamında HTTPS üzerinden kullanılmalıdır!

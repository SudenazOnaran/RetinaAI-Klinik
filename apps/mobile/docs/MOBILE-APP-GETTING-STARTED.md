# 🚀 Mobil Uygulama Geliştirme - Hızlı Başlangıç Kılavuzu

## 📋 Dosya Özeti

| Dosya | İçerik | Kullanım |
|-------|--------|----------|
| `MOBILE-API-ENTEGRASYON.md` | 📖 Detaylı API dokümantasyonu | Referans, tüm endpoint'ler, örnekler |
| `MOBILE-API-README.md` | ⚡ Hızlı başlangıç | API test, cURL örnekleri |
| `MOBILE-APP-PROMPT-TEMPLATE.md` | 🤖 Tam proje prompt'u | AI agent'a tam proje için ver |
| `MOBILE-APP-QUICK-PROMPTS.md` | 🎯 Senaryo bazlı prompt'lar | Belirli özellikler için ver |

---

## 🎯 Üç Adımda Başla

### Adım 1: AI Agent'ını Seç

- **ChatGPT** (GPT-4) - Web arayüz
- **Claude** (Sonnet/Opus) - Web arayüz  
- **GitHub Copilot Chat** - VS Code içinde
- **Cursor AI** - Kod editörü
- **Cline** (eski Claude Dev) - VS Code extension

### Adım 2: Dosyaları Hazırla

Mobil proje klasöründe şu dosyaların olduğundan emin ol:

```
mobile_project/
├── docs/
│   ├── MOBILE-API-ENTEGRASYON.md          ← API referansı
│   ├── MOBILE-APP-PROMPT-TEMPLATE.md      ← Ana prompt
│   └── MOBILE-APP-QUICK-PROMPTS.md        ← Hızlı prompt'lar
└── README.md
```

### Adım 3: Prompt Gönder

#### Seçenek A: Tüm Proje (Sıfırdan)

```
MOBILE-APP-PROMPT-TEMPLATE.md dosyasının tamamını kopyala ve agent'a yapıştır.
En sonda ekle: "Faz 1'den başla - Temel altyapıyı kur"
```

#### Seçenek B: Belirli Modül

```
MOBILE-APP-QUICK-PROMPTS.md'den istediğin senaryoyu kopyala.
Örnek: "Senaryo 3: Sadece Hasta Yönetimi Modülü"
```

---

## 🎨 Hangi Senaryoyu Seçmeliyim?

| İhtiyacın | Senaryo | Dosya |
|-----------|---------|-------|
| 🆕 Sıfırdan uygulama | Senaryo 1: Tüm proje | QUICK-PROMPTS.md |
| 🔐 Sadece login ekranı | Senaryo 2: Auth | QUICK-PROMPTS.md |
| 👥 Hasta yönetimi | Senaryo 3: Patients | QUICK-PROMPTS.md |
| 🔄 Offline sync | Senaryo 4: Sync | QUICK-PROMPTS.md |
| 🎨 UI iyileştirme | Senaryo 5: UI/UX | QUICK-PROMPTS.md |
| 🐛 Hata var | Senaryo 6: Debug | QUICK-PROMPTS.md |
| 📷 Kamera ekle | Senaryo 7: Camera | QUICK-PROMPTS.md |
| 🧪 Test yaz | Senaryo 8: Testing | QUICK-PROMPTS.md |
| 🔧 Özel özellik | Senaryo 9: Custom | QUICK-PROMPTS.md |

---

## 💬 Prompt Örnekleri (Copy-Paste)

### ChatGPT / Claude için:

```
RetinaAI Klinik için Flutter mobil uygulaması geliştiriyorum.

MEVCUT DOSYALAR:
- MOBILE-API-ENTEGRASYON.md (API dokümantasyonu)
- MOBILE-APP-PROMPT-TEMPLATE.md (Detaylı gereksinimler)

GÖREV: MOBILE-APP-PROMPT-TEMPLATE.md dosyasındaki tüm gereksinimlere göre Flutter projesi oluştur.

Platform: Flutter
State Management: Provider
Local DB: SQLite (mobil cihazda offline depolama)
Server DB: PostgreSQL (API üzerinden - web ile aynı DB)
API: https://your-domain.com/api/mobile/v1

Offline-first prensiplerine göre hasta ve analiz yönetimi yapacak.
Yerel SQLite → API sync → Sunucu PostgreSQL

Adım adım ilerleyelim. İlk adım: Flutter projesi kur ve dependencies ekle.
```

### GitHub Copilot Chat için:

```
@workspace MOBILE-API-ENTEGRASYON.md ve MOBILE-APP-PROMPT-TEMPLATE.md dosyalarını referans alarak Flutter projesi oluştur.

Gereksinimler:
- Offline-first hasta yönetimi
- JWT authentication
- SQLite local database
- Otomatik sync

#file:MOBILE-API-ENTEGRASYON.md
#file:MOBILE-APP-PROMPT-TEMPLATE.md

Başlayalım.
```

### Cursor AI için:

```
Cmd+K (veya Ctrl+K)

RetinaAI mobil uygulama: Flutter + offline-first

@MOBILE-API-ENTEGRASYON.md
@MOBILE-APP-PROMPT-TEMPLATE.md

Hasta yönetimi modülünü oluştur.
```

---

## 🔄 İterasyon Yapma

Agent bir şey ürettikten sonra:

### ✅ Doğrula
```
Bu kod MOBILE-API-ENTEGRASYON.md'deki Patient endpoint'leriyle uyumlu mu kontrol et.
```

### 🔧 İyileştir
```
Patient model'ine isSynced field'ı ekle. Offline kayıtları takip etmek için.
```

### 🐛 Debug
```
Bu hata neden oluyor:
[error logunu yapıştır]

MOBILE-API-ENTEGRASYON.md'ye göre ne eksik?
```

### 📝 Dokümante Et
```
Yazdığın SyncService için README oluştur. Nasıl çalıştığını açıkla.
```

---

## 📱 Platform Seçimi

### Flutter (Önerilen)
- ✅ Tek codebase (iOS + Android)
- ✅ Hızlı development
- ✅ Dokümantasyonda Flutter örnekleri var
- ✅ SQLite, Provider, Secure Storage paketleri hazır

**Prompt**: "Flutter + Provider + SQLite"

### React Native
- ✅ JavaScript ecosystem
- ✅ Geniş paket ekosistemi
- ⚠️ Native module bridge gerekebilir

**Prompt**: "React Native + Redux + AsyncStorage"

### Native (Swift/Kotlin)
- ✅ En yüksek performans
- ✅ Platform-specific özellikler
- ⚠️ İki ayrı codebase

**Prompt**: "Swift + SwiftUI + CoreData" veya "Kotlin + Jetpack Compose + Room"

---

## 🎓 Öğrenme Yolu

### Yeni Başlayan
1. ▶️ **Senaryo 2** (Auth) - Login ekranı yap
2. ▶️ **Senaryo 3** (Patients) - Hasta listesi yap
3. ▶️ **Senaryo 4** (Sync) - Offline sync öğren

### Orta Seviye
1. ▶️ **Senaryo 1** (Tüm proje) - Adım adım tamamla
2. ▶️ **Senaryo 5** (UI/UX) - Material Design 3 ekle
3. ▶️ **Senaryo 8** (Testing) - Test coverage ekle

### İleri Seviye
1. ▶️ Tüm senaryoları birleştir
2. ▶️ Push notifications ekle
3. ▶️ Background sync (WorkManager)
4. ▶️ Biometric authentication
5. ▶️ Analytics ve crash reporting

---

## 🆘 Sorun Giderme

### "Agent API endpoint'lerini yanlış kullanıyor"
```
❌ YANLIŞ: POST /api/patients
✅ DOĞRU: POST /api/mobile/v1/patients

MOBILE-API-ENTEGRASYON.md dosyasını tekrar oku. Base URL: /api/mobile/v1
```

### "Offline ID stratejisi çalışmıyor"
```
MOBILE-API-ENTEGRASYON.md "Offline ID Stratejisi" bölümünü takip et:
- Offline ID format: offline_<uuid>
- Server'a gönderince mapping al
- Yerel DB'yi mapping ile güncelle
```

### "Token expire olunca crash oluyor"
```
MOBILE-API-ENTEGRASYON.md "Token Yenileme" bölümünü implement et:
- 401 response yakalanmalı
- Token silinmeli
- Login sayfasına yönlendirme
```

### "Agent kodu eksik üretiyor"
```
Prompt'una ekle: "MOBILE-API-ENTEGRASYON.md'deki örneği tam olarak implement et. Eksik bırakma."
```

---

## ✅ Kontrol Listesi

Proje bitmeden önce kontrol et:

### Temel Özellikler
- [ ] Login/logout çalışıyor
- [ ] Token güvenli depolanıyor
- [ ] Hasta ekleme (online + offline)
- [ ] Hasta listeleme
- [ ] Analiz ekleme (kamera)
- [ ] Offline sync çalışıyor
- [ ] ID mapping doğru

### UI/UX
- [ ] Loading states var
- [ ] Error handling var
- [ ] Empty states var
- [ ] Offline indicator var
- [ ] Pull-to-refresh var

### Teknik
- [ ] HTTPS kullanılıyor (production)
- [ ] Token interceptor çalışıyor
- [ ] Local DB düzgün
- [ ] Memory leak yok
- [ ] Crash-free

### Test
- [ ] Unit tests yazıldı
- [ ] Integration tests yazıldı
- [ ] Manual test yapıldı
- [ ] API endpoint'leri doğru

---

## 🚀 Başarı İçin İpuçları

1. **Adım adım git** - Tüm projeyi bir seferde isteme
2. **Dokümantasyona referans ver** - "MOBILE-API-ENTEGRASYON.md'ye göre"
3. **Test et** - Her adımda çalıştır ve test et
4. **Kod oku** - Agent'ın ürettiği kodu anla
5. **İyileştir** - Eksikleri agent'a söyle
6. **Sabırlı ol** - Büyük projeler zaman alır

---

## 📞 Yardım

Tıkanırsan:
- 📖 **MOBILE-API-ENTEGRASYON.md** - API referansı
- 🤖 **MOBILE-APP-PROMPT-TEMPLATE.md** - Detaylı gereksinimler
- 🎯 **MOBILE-APP-QUICK-PROMPTS.md** - Hızlı çözümler

**Başarılar!** 🎉

# Play Store Yayın Kontrol Listesi — Retina AI Klinik

Bu belge, uygulamayı Google Play Store'a göndermeden önce tamamlanması gereken
her adımı içerir. Her maddeyi tamamladıkça kutucuğu işaretleyin.

---

## 1. Teknik Hazırlık

### Firebase
- [ ] Firebase Console'da proje oluştur (https://console.firebase.google.com)
- [ ] Android uygulaması ekle → paket adı: `com.retinaai.klinik`
- [ ] `google-services.json` indir → `apps/mobile/android/app/` klasörüne koy
- [ ] `flutter pub get` çalıştır
- [ ] `flutter run --release` ile Firebase bağlantısını test et
- [ ] Crashlytics Dashboard'da test çöküşünü doğrula

### Keystore / İmzalama
- [ ] Upload keystore oluştur (bkz. `docs/KEYSTORE-GUIDE.md`)
- [ ] `android/key.properties` dosyasını oluştur (şablona göre)
- [ ] `key.properties` dosyasını `.gitignore`'a ekle (GİZLİ!)
- [ ] Keystore dosyasını güvenli yedekle (şifre + alias not al)

### Release Build
- [ ] `flutter build appbundle --release` çalıştır
- [ ] `build/app/outputs/bundle/release/app-release.aab` dosyasını doğrula
- [ ] APK boyutunu kontrol et (ideal: <50 MB)
- [ ] Release modda test et (emulator veya fiziksel cihaz)

### Kod Kalitesi
- [ ] `flutter analyze` — sıfır hata
- [ ] `flutter test` — tüm testler yeşil
- [ ] Konsol log'larını temizle (kSecure debug print'ler kaldırıldı mı?)

---

## 2. Google Play Console Hazırlığı

### Hesap
- [ ] Google Play Developer hesabı aktif ($25 kayıt ücreti ödenmiş)
- [ ] Geliştirici adı ve iletişim bilgileri güncel

### Uygulama Oluşturma
- [ ] Yeni uygulama oluştur → "Retina AI Klinik"
- [ ] Dil: Türkçe (varsayılan) + İngilizce
- [ ] Kategori: Tıp (Medical)
- [ ] Uygulama türü: Uygulama (App, oyun değil)

### İçerik
- [ ] Kısa açıklama girildi (bkz. `docs/PLAY-STORE-LISTING.md`)
- [ ] Uzun açıklama girildi
- [ ] Ekran görüntüleri yüklendi (en az 2, önerilen 5)
- [ ] Feature Graphic yüklendi (1024x500 px)
- [ ] Uygulama ikonu yüklendi (512x512 px PNG)

---

## 3. Politika & Uyum

### Gizlilik & Yasal
- [ ] Gizlilik politikası URL'si girildi: `https://retina-ai.tech/gizlilik`
- [ ] Web'de gizlilik sayfası yayında ve erişilebilir
- [ ] Kullanım koşulları URL'si girildi: `https://retina-ai.tech/kullanim-kosullari`

### Data Safety Form
- [ ] "Veri güvenliği" formu dolduruldu (bkz. `docs/PLAY-STORE-LISTING.md`)
- [ ] Sağlık verisi kullanımı açıklandı
- [ ] Firebase Analytics (anonim) beyan edildi
- [ ] Firebase Crashlytics beyan edildi
- [ ] "Veri şifreleniyor" işaretlendi
- [ ] "Veri silme talebi kabul ediliyor" işaretlendi

### İçerik Derecelendirme
- [ ] İçerik derecelendirme anketi tamamlandı
- [ ] Sağlık/Tıp beyanı dolduruldu

### Hedef Kitle
- [ ] Hedef kitle 18+ (yalnızca sağlık profesyonelleri) seçildi
- [ ] "Çocuklara yönelik değil" işaretlendi

---

## 4. Sağlık Uygulaması Gereksinimleri

- [ ] Uygulama içinde tıbbi sorumluluk reddi beyanı var
  - `settings_screen.dart` Yasal bölümünde link mevcut ✅
  - `kullanim-kosullari` sayfasında uyarı var ✅
- [ ] "Tanı koymaz, destek aracıdır" uyarısı kullanıcıya gösteriliyor
- [ ] Yalnızca lisanslı profesyoneller için olduğu belirtiliyor
- [ ] Admin onay sistemi açıklanıyor (kendi kendine kayıt yok)

---

## 5. Son Kontroller

### Test
- [ ] Giriş akışı uçtan uca test edildi
- [ ] Hasta ekleme → analiz → rapor akışı test edildi
- [ ] Ayarlar → Gizlilik Politikası linki tarayıcıda açılıyor
- [ ] Ayarlar → Kullanım Koşulları linki tarayıcıda açılıyor
- [ ] Offline modda uygulama çökmüyor
- [ ] Büyük ekran (tablet) uyumluluğu kontrol edildi

### Gönderim
- [ ] AAB dosyası Play Console'a yüklendi
- [ ] İç test kanalına (Internal Testing) gönderildi
- [ ] İç test sonuçları tatmin edici
- [ ] Kapalı test (Closed Testing) yapıldı
- [ ] Üretim sürümüne (Production) gönderimine hazır

---

## Kritik Dosyalar

| Dosya | Durum |
|-------|-------|
| `android/app/google-services.json` | ⚠️ Manuel: Firebase'den indir |
| `android/upload-keystore.jks` | ⚠️ Manuel: Oluşturulacak |
| `android/key.properties` | ⚠️ Manuel: Şablondan oluştur |
| `android/app/proguard-rules.pro` | ✅ Hazır |
| `lib/main.dart` (Firebase init) | ✅ Hazır |
| `lib/screens/settings_screen.dart` (Yasal) | ✅ Hazır |
| `apps/web/.../gizlilik/page.tsx` | ✅ Hazır (deploy gerekli) |
| `apps/web/.../kullanim-kosullari/page.tsx` | ✅ Hazır (deploy gerekli) |

---

## Notlar

- Keystore şifresini ve alias'ı şifreli bir yerde (1Password, Bitwarden) sakla.
  Kaybolursa uygulama güncellemesi yayınlayamazsın!
- `google-services.json` gizli tutulmalı, git'e commit edilmemeli.
- AAB (Android App Bundle) tercih et, APK değil. Play Store bunu gerektirir.

# Keystore Oluşturma Rehberi — Retina AI Klinik

Google Play'e uygulama yayınlayabilmek için bir **upload keystore** gereklidir.
Bu keystore ile imzalanan AAB dosyası Play Store'a yüklenir.

---

## Adım 1: Keystore Oluştur

`apps/mobile` klasöründe aşağıdaki komutu çalıştır:

```bash
keytool -genkey -v \
  -keystore android/upload-keystore.jks \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias upload
```

**Windows CMD/PowerShell için:**
```powershell
keytool -genkey -v -keystore android\upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

> `keytool` bulunamazsa Java JDK yüklü olmalı. Android Studio ile birlikte gelir:
> `C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`

**Sorulacak bilgiler:**
- Keystore şifresi (en az 6 karakter) — NOT AL!
- Ad Soyad / Organizasyon / Şehir / Ülke
- Key şifresi (keystore şifresiyle aynı olabilir)

---

## Adım 2: key.properties Dosyasını Oluştur

`apps/mobile/android/key.properties` dosyasını oluştur
(şablon: `android/key.properties.template`):

```properties
storePassword=<keystore-sifren>
keyPassword=<key-sifren>
keyAlias=upload
storeFile=../upload-keystore.jks
```

> **ÖNEMLİ:** `key.properties` dosyasını asla git'e commit etme!
> `.gitignore` içinde zaten tanımlı olmalı.

---

## Adım 3: .gitignore Kontrolü

`apps/mobile/android/.gitignore` veya kök `.gitignore` dosyasında şu satırların olduğunu doğrula:

```gitignore
# Keystore dosyaları — asla commit edilmez
*.jks
*.keystore
android/key.properties
```

---

## Adım 4: Release Build Al

```bash
cd apps/mobile
flutter build appbundle --release
```

Çıktı: `build/app/outputs/bundle/release/app-release.aab`

---

## Adım 5: AAB'yi Play Console'a Yükle

1. [Google Play Console](https://play.google.com/console) → Uygulamanı seç
2. **Sürüm** → **Üretim** (veya İç Test) → **Yeni sürüm oluştur**
3. `app-release.aab` dosyasını yükle
4. Sürüm notlarını gir
5. **Kaydet → İncele → Yayınla**

---

## Keystore Güvenliği

> ⚠️ Keystore'u kaybetmek uygulamayı güncelleme imkânını sonsuza kadar yok eder!

**Yedekleme adımları:**
1. `android/upload-keystore.jks` dosyasını güvenli bir bulut depolama alanına koy
   (Google Drive'ın gizli klasörü, şifreli USB)
2. Şifreyi ve alias'ı bir şifre yöneticisine kaydet (1Password, Bitwarden, KeePass)
3. Ekip üyeleriyle güvenli kanal üzerinden paylaş (asla e-posta ile değil)

---

## Mevcut Konfigürasyon

`apps/mobile/android/app/build.gradle.kts` zaten şu şekilde yapılandırıldı:

```kotlin
// android/app/build.gradle.kts
signingConfigs {
    create("release") {
        keyAlias = keystoreProperties["keyAlias"] as String
        keyPassword = keystoreProperties["keyPassword"] as String
        storeFile = file(keystoreProperties["storeFile"] as String)
        storePassword = keystoreProperties["storePassword"] as String
    }
}
buildTypes {
    release {
        signingConfig = signingConfigs.getByName("release")
        isMinifyEnabled = true
        isShrinkResources = true
        proguardFiles(
            getDefaultProguardFile("proguard-android-optimize.txt"),
            "proguard-rules.pro"
        )
    }
}
```

> Eğer `build.gradle.kts` dosyanda signingConfigs bloğu yoksa eklemek gerekir.
> Mevcut durumu kontrol et: `apps/mobile/android/app/build.gradle.kts`

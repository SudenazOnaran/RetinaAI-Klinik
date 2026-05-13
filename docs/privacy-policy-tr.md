# Gizlilik Politikası — Retina AI Klinik

**Son güncelleme:** Mayıs 2026  
**Uygulama:** Retina AI Klinik (com.retinaai.klinik)  
**Veri Sorumlusu:** Retina AI Klinik  
**İletişim:** [destek e-posta adresi]

---

## 1. Giriş

Bu Gizlilik Politikası, Retina AI Klinik mobil uygulamasını ("Uygulama") kullanırken kişisel verilerinizin nasıl toplandığını, işlendiğini ve korunduğunu açıklamaktadır. 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu olarak hareket etmekteyiz.

---

## 2. Toplanan Veriler

### 2.1 Hesap Bilgileri
- Ad, soyad
- E-posta adresi
- Uzmanlık alanı ve lisans numarası
- Klinik / branş bilgisi

### 2.2 Hasta Verileri
- Hasta adı ve TC kimlik numarası (maskelenmiş şekilde saklanır)
- Yaş, cinsiyet
- HbA1c değerleri ve klinik notlar
- Fundus göz fotoğrafları
- Yapay zeka analiz sonuçları ve risk skorları

### 2.3 Teknik Veriler
- Cihaz bilgisi ve işletim sistemi versiyonu
- Uygulama çökme raporları (Firebase Crashlytics)
- Anonim kullanım istatistikleri (Firebase Analytics)
- IP adresi (sunucu logları)

### 2.4 Toplanmayan Veriler
- Konum bilgisi
- Kişisel fotoğraf (yalnızca fundus görüntüsü)
- Finansal bilgiler (ödeme işlemleri üçüncü taraf aracılığıyla yapılır)

---

## 3. Verilerin İşlenme Amaçları

| Amaç | Hukuki Dayanak |
|------|---------------|
| Hesap oluşturma ve kimlik doğrulama | Sözleşmenin ifası |
| Hasta kaydı ve takibi | Meşru menfaat / Açık rıza |
| Fundus analizi ve risk değerlendirmesi | Meşru menfaat / Açık rıza |
| Uygulama güvenliği ve hata ayıklama | Meşru menfaat |
| Kullanım istatistikleri | Meşru menfaat |
| Yasal yükümlülüklerin yerine getirilmesi | Kanuni yükümlülük |

---

## 4. Veri Güvenliği

Verileriniz aşağıdaki güvenlik önlemleriyle korunmaktadır:

- **İletim güvenliği:** Tüm API iletişimi HTTPS/TLS ile şifrelenir
- **Depolama güvenliği:** Kimlik doğrulama tokenleri `flutter_secure_storage` ile cihazda şifreli saklanır
- **Yerel veritabanı:** Hasta verileri cihazda SQLite ile tutulur, iCloud/Google Drive yedeklemesine dahil edilmez
- **Sunucu güvenliği:** Veriler güvenli veri merkezlerinde saklanır
- **Erişim kontrolü:** Her doktor yalnızca kendi hasta verilerine erişebilir

---

## 5. Üçüncü Taraf Hizmetler

| Hizmet | Amaç | Gizlilik Politikası |
|--------|------|---------------------|
| Firebase Analytics (Google) | Anonim kullanım istatistikleri | [Google Gizlilik](https://policies.google.com/privacy) |
| Firebase Crashlytics (Google) | Uygulama çökme raporları | [Google Gizlilik](https://policies.google.com/privacy) |
| RevenueCat | Abonelik yönetimi | [RevenueCat Gizlilik](https://www.revenuecat.com/privacy) |

Bu hizmetler kendi gizlilik politikaları kapsamında veri işleyebilir. Hasta sağlık verileri hiçbir üçüncü tarafla paylaşılmaz.

---

## 6. Veri Saklama Süresi

| Veri Türü | Saklama Süresi |
|-----------|---------------|
| Hesap bilgileri | Hesap silinene kadar |
| Hasta kayıtları | Hesap silinmesinden itibaren 90 gün |
| Analiz sonuçları | Hesap silinmesinden itibaren 90 gün |
| Crash raporları | 90 gün (Firebase otomatik silme) |
| Sunucu logları | 30 gün |

---

## 7. Haklarınız (KVKK Madde 11)

KVKK kapsamında aşağıdaki haklara sahipsiniz:

- **Bilgi edinme:** Hangi verilerinizin işlendiğini öğrenme
- **Erişim:** Verilerinizin bir kopyasını talep etme
- **Düzeltme:** Hatalı verilerin düzeltilmesini isteme
- **Silme:** Verilerinizin silinmesini talep etme
- **İtiraz:** Otomatik kararlara itiraz etme
- **Aktarım:** Verilerinizi taşınabilir formatta alma

Bu hakları kullanmak için: **[destek e-posta adresi]** adresine yazabilirsiniz. Taleplerinize 30 gün içinde yanıt verilir.

---

## 8. Tıbbi Sorumluluk Reddi

Bu uygulama **yalnızca sağlık profesyonellerine** yönelik bir karar destek aracıdır. Yapay zeka analiz sonuçları kesin tıbbi tanı niteliği taşımaz ve bir uzman doktorun klinik değerlendirmesinin yerini alamaz.

---

## 9. Çocuklara İlişkin Veriler

Uygulama 18 yaş altındaki bireylere yönelik değildir. Çocuklara ait kişisel veri bilinçli olarak toplanmaz.

---

## 10. Gizlilik Politikası Değişiklikleri

Bu politika güncellendiğinde uygulama içi bildirim veya e-posta ile bilgilendirilirsiniz. Güncel politika her zaman bu sayfada yayınlanır.

---

## 11. İletişim

Gizlilik ile ilgili sorularınız için:  
**E-posta:** [destek e-posta adresi]  
**Adres:** [Şirket adresi]

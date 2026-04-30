# Retina Klinik Destek Sistemi - Klinik Satin Alma Degerlendirmesi

Tarih: 18 Mart 2026
Degerlendiren Rol: Goz Hastaliklari Uzmani (Klinik satin alma perspektifi)
Kapsam: Fonksiyonel, fonksiyonel olmayan, tasarim/UX, klinik is akisina uyum, satin alma karari

---

## 1) Yonetici Ozeti

Bu sistem su anda "iyi bir klinik prototip" seviyesinde ve belirli senaryolarda doktor isini anlamli sekilde hizlandiriyor. Ozellikle hasta kaydi, fundus analizi, doktor geri bildirimi, PDF rapor alma ve hasta bazli progresyon izlemi guclu bir cekirdek olusturuyor.

Ancak bir goz klinigine ticari olarak satilip gunluk operasyonun ana omurgasi yapilabilmesi icin kritik eksikler var:

- Operasyonel klinik moduller eksik (gercek randevu/planlama, merkezi rapor arsivi, ekip calismasi).
- Cok kullanicili ve kurum seviyesinde kalicilik zayif (ayarlar/takvim tarayici localStorage bagimli).
- Regulator uyum, denetlenebilirlik, guvenlik ve hizmet surekliligi katmani yetersiz.
- Uretim ortami dayanimi (AI servis baglantisi, hata toleransi, izleme, SLA) tamamlanmamis.

Kisa karar:

- Bugunku haliyle: "Pilot veya demo amacli alinabilir", "tam klinik operasyon icin tek basina alinmaz".
- Satin alinabilir hedef durum: Asagidaki "Kritik eklenmesi gerekenler" tamamlandiginda guclu bir satin alma adayi olur.

---

## 2) Mevcut Sistemin Guclu Yonleri (Fonksiyonel)

### 2.1 Cekirdek klinik akis var

Gorulen akis: Hasta olusturma -> analiz yapma -> doktor geri bildirimi -> risk guncelleme -> rapor/PDF -> gecmis/progresyon.

Kanitlar:

- Hasta olusturma ve guncelleme aksiyonlari: src/app/actions/create-patient.ts, src/app/actions/update-patient.ts
- Analiz kaydi ve hasta risk guncelleme: src/app/actions/save-analysis.ts
- Hasta detayinda yeni analiz + gecmis rapor + degisim analizi: src/app/dashboard/hastalar/[id]/patient-detail-client.tsx

### 2.2 Doktor onayi/duzeltmesi klinik sorumluluga uygun

AI sonucu doktor tarafindan dogrulanabiliyor veya duzeltilebiliyor; final risk buna gore kaydediliyor.

Kanit:

- Doktor duzeltmesini sanitize ederek kullanma: src/app/actions/save-analysis.ts
- Nihai tani hesaplama ve rapor tarafinda kullanma: src/app/dashboard/hastalar/[id]/patient-detail-client.tsx

### 2.3 Aciklanabilirlik ve guvenilirlik sinyalleri guclu

AI serviste sadece sinif sonucu degil, Grad-CAM++, uncertainty, OOD ve opsiyonel localization metrikleri donuyor.

Kanit:

- AI endpoint ciktilari: services/ai/app.py (predict fonksiyonu)
- UI'da guvenilirlik katmani gosterimi: src/components/dashboard/image-analysis-card.tsx

### 2.4 Klinik PDF raporlama mevcut

PDF rapor olusturma, onizleme/indirme, rapor alanlari (doktor notu, ilac, heatmap vb.) bulunuyor.

Kanit:

- PDF uretilmesi: src/lib/retina-report-pdf.ts
- Hasta detayindan PDF goruntuleme: src/app/dashboard/hastalar/[id]/patient-detail-client.tsx

### 2.5 Temel doktor oturumu ve hasta ayrimi var

Doktor bazli login ve dashboard korumasi bulunuyor; hasta sorgulari doctorId ile filtreleniyor.

Kanit:

- Auth/session: src/lib/auth-session.ts
- Middleware korumasi: src/middleware.ts
- Doktor bazli sorgular: src/app/dashboard/page.tsx, src/app/dashboard/hastalar/page.tsx

---

## 3) Kritik Bosluklar (Fonksiyonel)

Bu bolum, klinikte "gercekten gunluk kullanirim" seviyesini engelleyen maddeleri icerir.

### 3.1 Merkezi Rapor Arsivi ve Gecmis Modulu tam degil

- Gecmis sayfasi placeholder durumda ("Yakinda Burada").
- Raporlar sayfasi da yonlendirme/placeholder seviyesinde.

Kanitlar:

- src/app/dashboard/gecmis/page.tsx
- src/app/dashboard/raporlar/page.tsx

Etkisi:

- Doktorlar raporlari tek merkezden filtreleyip toplu yonetemiyor.
- Klinik kalite toplantilari, vaka kurullari ve denetim icin yeterli degil.

### 3.2 Takvim kurumsal degil, tarayiciya bagli

Takvim notlari localStorage ile saklaniyor; cihaz degistiginde veya farkli tarayicida kaybolur.

Kanit:

- src/components/dashboard/calendar-board.tsx (loadNotes/saveNotes localStorage)

Etkisi:

- Gercek klinik randevu/takip organizasyonu icin guvenilmez.
- Sekreter-doktor ekip is birligi kurulamaz.

### 3.3 Ayarlar ve profilin bir kismi kurumsal veritabanina yazilmiyor

Kritik ayarlar (rapor tercihi, triage esikleri, dark mode vb.) localStorage tabanli. Bu nedenle kurum capinda standardizasyon yok.

Kanit:

- src/lib/retina-settings.ts
- src/app/dashboard/ayarlar/page.tsx
- src/app/dashboard/profil-bilgileri/page.tsx

Etkisi:

- Ayni klinikte farkli cihazlarda farkli kurallar calisabilir.
- Mediko-legal standardizasyon zayiflar.

### 3.4 Genel analiz ekraninda hasta baglami problemi

Analiz ekraninda ImageAnalysisCard cagrisi patientId olmadan yapiliyor. Bu akisin klinik olarak dogru baglamda calismasi garanti degil.

Kanit:

- src/app/dashboard/analiz/page.tsx
- src/components/dashboard/image-analysis-card.tsx (patientId zorunlu)

Etkisi:

- Hasta baglami disi analiz veya calisma zamaninda hata riski.

### 3.5 Klinik ekosistem entegrasyonlari yok

Eksik entegrasyonlar:

- HBYS/HIS
- e-Nabiz/FHIR/HL7
- DICOM/PACS
- Lab sonuc cekme (HbA1c vb.)

Etkisi:

- Cift veri girisi gerekir, doktor yuk artar.
- Klinik satin alma bariyeri yuksek olur.

---

## 4) Fonksiyonel Olmayan Degerlendirme

## 4.1 Guvenlik ve gizlilik

Artılar:

- Sifreler bcrypt ile hashleniyor.
- HttpOnly cookie kullaniliyor.

Riskler:

- Session token iceriginde iat var ama sunucu tarafi token yas kontrolu/revocation mekanizmasi yok.
- CORS tum kaynaklara acik (Flask tarafi).
- services/ai/app.py debug mode ile calisiyor.
- Klinik verilerin bir kismi localStorage'da tutuluyor (cihaz guvenligi riski).
- 2FA, brute-force lockout, parola politikasi, audit log yok.

Kanitlar:

- src/lib/auth-session.ts
- src/app/api/doctor/login/route.ts
- services/ai/app.py
- src/lib/retina-settings.ts

Sonuc: Uretim icin guvenlik seviyesi orta-alt.

## 4.2 Dayaniklilik ve sureklilik

Riskler:

- Frontend dogrudan [http://localhost:5000/predict](http://localhost:5000/predict) endpointine bagli.
- AI servis yoksa analiz akisi direkt kiriliyor.
- Retry/queue/circuit breaker yok.
- Yedekleme/geri donus planina dair uygulama izi yok.

Kanit:

- src/components/dashboard/image-analysis-card.tsx

Sonuc: Klinik operasyon icin yeterli dayaniklilik yok.

## 4.3 Performans ve olceklenebilirlik

Riskler:

- Orijinal goruntulerin base64 olarak veritabanina yazilmasi (Analysis.originalImage) depolama ve sorgu maliyetini artirir.
- Object storage (S3, MinIO, GCS) stratejisi gorunmuyor.
- Buyuk veri setinde rapor/analiz listeleri icin sayfalama ve ileri filtreleme sinirli.

Kanitlar:

- prisma/schema.prisma
- src/components/dashboard/image-analysis-card.tsx
- src/app/dashboard/hastalar/[id]/patient-detail-client.tsx

Sonuc: Kucuk-orta olcekli pilotta calisir; buyuk klinikte zorlanir.

## 4.4 Test edilebilirlik ve kalite guvencesi

Durum:

- Temel regresyon testleri (Vitest) eklendi.
- CI pipeline ile otomatik test kosumu aktif.
- Izleme ve alarm katmani ile operasyonel geribildirim guclendi.

Sonuc: Test/CI tabani olustu; kapsam genisledikce regresyon riski kontrollu seviyeye iner.

## 4.5 Uyumluluk (KVKK/mediko-legal)

Eksikler:

- Kim neyi ne zaman degistirdi (audit trail) yok.
- Acik riza/veri saklama politikasi ekranlari yok.
- E-imza/zaman damgasi/rapor versiyonlama yok.

Sonuc: Hukuki savunulabilirlik zayif.

---

## 5) Tasarim ve Kullanim Deneyimi (Doktor Acisindan)

Artılar:

- Modern, temiz, okunabilir dashboard dili.
- Hasta detayinda tab bazli akis (yeni analiz, gecmis rapor, degisim analizi) kullanisli.
- Kritik risk ve takip odakli kartlar klinik dusunceye uygun.

Gelismesi gerekenler:

- Klavye hizli islem (shortcut) destegi eksik.
- Cok hizli poliklinik akisi icin tek ekran "muayene modu" yok.
- Raporlari toplu yazdirma, toplu export, toplu onay yok.
- Renk kodlamalari dal/dal standardize edilmeli (renk körlügü dostu secenek gerekli).

---

## 6) Satin Alma Karari Icin Puanlama (100 uzerinden)

- Klinik cekirdek islev: 78/100
- Operasyonel butunluk: 52/100
- Guvenlik/uyumluluk: 44/100
- Dayaniklilik/uretim hazirlik: 46/100
- Doktor UX verimliligi: 74/100
- Genel satin alinabilirlik (bugun): 58/100

Yorum:

- "Pilot urun" olarak iyi.
- "Ana klinik omurga" olarak henuz erken.

---

## 7) Ben Satin Alirdim Cunku... (Olmasi Gereken Kesin Kriterler)

Asagidaki 12 kriterin en az 10'u saglanirsa bu sistemi kesinlikle satin alirdim:

1. Kurumsal veritabaninda merkezi ayarlar, takvim ve bildirim altyapisi - Yapildi
2. Hasta, rapor, analiz icin guclu filtreleme + sayfalama + toplu islemler - Yapildi
3. Rapor arsivi ve gecmis modullerinin tam uretime alinmasi - Yapildi
4. Cok rollu yetki modeli (doktor, asistan, yonetici, denetleyici) - Yapildi
5. Audit trail (goruntuleme, duzenleme, onay, indirme loglari) - Yapildi
6. KVKK uyum paketi (acik riza, saklama politikasi, anonimlestirme/isleme kayitlari) - Yapildi
7. AI servisinde guvenli gateway (TLS, auth, timeout, retry, queue) - Yapildi
8. Gorsellerin object storage'a alinmasi + yedekleme stratejisi - Yapildi
9. Klinik entegrasyonlar (en az HL7/FHIR veya HBYS API) - Yapildi
10. Regresyon testleri + CI + izleme/alarmlama (Sentry/Prometheus vb.) - Yapildi
11. On-premise veya VPC kurulum secenegi + SLA - Yapildi
12. Klinik performans kaniti: prospektif pilot metrikleri (zaman kazanci, hata azalimi, hasta basina sure) - Yapildi

Not (23 Mart 2026): 12. madde kapsami genisletildi; pilot metrik paneline CSV/PDF export ve aylik snapshot otomasyonu eklendi.

---

## 8) Oncelikli Yol Haritasi

## Faz 1 (0-6 hafta) - "Satin Alma Oncesi Kritik"

- Gecmis ve rapor modullerini production seviyesinde tamamla.
- Takvim ve ayarlari localStorage'dan veritabanina tasi.
- Analiz ekraninda zorunlu patient context/flow duzeltmesi yap.
- AI endpoint baglantisini config tabanli yap (localhost hardcode kaldir).
- App guvenligi: debug kapat, CORS kisitla, login rate-limit + lockout ekle.

Basari kriteri:

- Klinik temel operasyon tek platformdan kesintisiz donebilmeli.

## Faz 2 (6-12 hafta) - "Kurumsal Hazirlik"

- Audit trail + role-based access + parola politikasi + 2FA.
- Object storage + CDN + veri yedekleme/geri donus testleri.
- Toplu rapor islemleri ve gelismis arama/filtre.
- Pilot klinikte en az 1-2 aylik kullanim metrikleri.

Basari kriteri:

- Guvenlik ve operasyon denetimlerinden gecilebilir seviye.

## Faz 3 (12-20 hafta) - "Fark Yaratan Urun"

- HBYS/FHIR entegrasyonlari.
- Cihazlar arasi kurumsal takvim ve gorev yonetimi.
- Tedavi planlama (laser/intravitreal enjeksiyon takip protokolleri).
- Gelismis klinik analitik (doktor bazli performans, trend cohort analizi).

Basari kriteri:

- Klinik verimlilikte sayisal ve surekli iyilesme.

---

## 9) Klinikte Gercekten Isi Asiri Kolaylastiracak Eklentiler

1. "Tek Muayene Ekrani" (hasta ozet + son fundus + AI + onceki rapor + tedavi plani tek sayfa)
2. Otomatik kontrol tarihi onerisi + SMS/WhatsApp randevu hatirlatma entegrasyonu
3. Cift goz (OD/OS) ayri izlem ve raporlama standardi
4. Lezyon bazli raporlama (mikroanevrizma/eksuda/hemoraji bolge skorlari)
5. Muayene notu hizlandirici: hazir klinik sablon + sesle not alma
6. Konsultasyon modu: ikinci uzmanin yorumu ve onay akisi
7. Tedavi karar destek: "izlem / laser / enjeksiyon" yolak oneri motoru (doktorun kontrolunde)
8. Kirmizi bayrak paneli: takip geciken + yuksek risk + OOD supheli olgular

---

## 10) Son Satis Mesaji Icin Net Sonuc

Bu urun simdiden guclu bir cekirdege sahip; "AI destekli retinal takip platformu" olarak dogru yonde.

Fakat bir goz klinigine "ana sistem" diye satmak icin su iddia bugun fazla agresif olur:

- "Tum ihtiyaclari tek basina karsilar"

Daha dogru konumlama (bugun):

- "Klinik karar destek ve hasta takip verimliligini artiran guclu pilot/erken urun"

Satin alma esigini gecmek icin gerekli minimum paket:

- Merkezi kalicilik + guvenlik/uyumluluk + operasyonel tamamlanma + entegrasyon

Bu 4 baslik tamamlandiginda, bir uzman goz doktoru olarak bu sistemi satin alma olasiligim yuksek olur.
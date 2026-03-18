# Fundus Goruntuleri Icin Profesyonel XAI Yontemleri

Bu dokuman, mevcut Grad-CAM heatmap yaklasimini degistirmeden, onu daha profesyonel bir XAI (aciklanabilir yapay zeka) cercevesine tasimak icin kullanilabilecek yontemleri derler.

## 1) Neden sadece tek heatmap yeterli olmayabilir?

Grad-CAM, modelin hangi bolgeye odaklandigini gosterir ama tek basina su sorularin hepsini cevaplamaz:

- Aciklama model karariyla nedensel olarak baglantili mi?
- Aciklama farkli goruntulerde tutarli mi?
- Aciklama klinik olarak anlamli anatomik bolgelere denk geliyor mu?
- Ayni vaka icin farkli XAI yontemleri benzer bulgu veriyor mu?
- Aciklama modelin guven seviyesini ve belirsizligini yansitiyor mu?

Bu nedenle profesyonel sistemlerde genelde coklu-XAI katmani kullanilir.

## 2) CAM tabanli ileri yontemler (heatmap ailesi)

### 2.1 Grad-CAM++

- Ne yapar: Grad-CAM'in coklu lezyon veya birden fazla etkin bolge durumlarinda daha iyi lokalizasyon vermesini saglar.
- Ne zaman iyi: Fundusda birden fazla patolojik odak oldugunda.
- Artisi: Daha hassas bolge ayrimi.
- Eksisi: Hesaplama maliyeti biraz daha yuksek.

### 2.2 XGrad-CAM

- Ne yapar: Gradyan agirliklandirmasini daha kararlı hale getirir.
- Ne zaman iyi: Model ciktilari dalgaliysa veya heatmap kararsizsa.
- Artisi: Daha stabil gorsel aciklama.

### 2.3 Score-CAM

- Ne yapar: Gradyan yerine aktivasyon haritalarini girdiye maske gibi uygulayip skor degisimine gore aciklama olusturur.
- Ne zaman iyi: Gradyan gurultusunun yuksek oldugu durumlarda.
- Artisi: Daha az gurultulu ve daha yorumlanabilir harita.
- Eksisi: Yavas olabilir.

### 2.4 Ablation-CAM

- Ne yapar: Ozellik kanallarini tek tek etkisizlestirip skor etkisine bakar.
- Ne zaman iyi: Nedensellige daha yakin bir sinyal istendiginde.
- Artisi: "Bu kanal kapaninca skor ne kadar dustu" bilgisi guclu.

### 2.5 Eigen-CAM

- Ne yapar: Aktivasyon uzayinin baskin bileseninden aciklama cikarir.
- Ne zaman iyi: Hizli, siniftan bagimsiz gorsel odak analizi gerektiginde.
- Artisi: Hizli ve pratik.
- Eksisi: Sinif-ozel aciklama zayif olabilir.

## 3) Piksel-duzeyi atribusyon yontemleri

### 3.1 Integrated Gradients (IG)

- Ne yapar: Referans (baseline) goruntuden mevcut goruntuye giden yol boyunca gradyanlari entegre eder.
- Klinik degeri: "Hangi piksel model skorunu ne kadar artirdi/azaltti" sorusuna daha prensipli cevap verir.
- Onemli nokta: Baseline secimi kritik (siyah, blur, ortalama fundus, vs).

### 3.2 SmoothGrad / VarGrad

- Ne yapar: Girdiye ufak gurultuler ekleyip atribusyonu ortalayarak daha temiz harita verir.
- Ne zaman iyi: Tek seferde noisy attribution aliniyorsa.
- Artisi: Daha guvenilir gorunurluk.

### 3.3 Saliency, Guided Backprop, Guided Grad-CAM

- Ne yapar: Kenar ve ince yapilari daha net gosterir.
- Ne zaman iyi: Damar yapisi, mikroanevrizma gibi ince detaylari incelemede.
- Risk: Bazi yontemler "gorsel olarak guzel ama nedensel olarak zayif" olabilir, tek basina karar vermeye uygun degildir.

### 3.4 DeepLIFT / Layer-wise Relevance Propagation (LRP)

- Ne yapar: Skoru katman katman geriye dagitarak relevans haritasi uretir.
- Ne zaman iyi: "Model skoru hangi yolaktan geldi" sorusu onemliyse.
- Artisi: Kural tabanli dagitimla daha yapisal aciklama.

## 4) Perturbation ve occlusion tabanli aciklama

### 4.1 Occlusion Sensitivity

- Ne yapar: Goruntunun parcali bolgelerini kapatip skor dususune bakar.
- Klinik degeri: Nedensellige en yakin pratik testlerden biri.
- Artisi: "Bu bolgeyi kapatinca karar bozuluyor mu" net gorulur.
- Eksisi: Hesaplama maliyeti yuksek.

### 4.2 RISE (Randomized Input Sampling for Explanation)

- Ne yapar: Rastgele maskelerle coklu ornekleme yapar, skor katkilarini istatistiksel olarak toplar.
- Ne zaman iyi: Gradyan kullanmadan robust aciklama istendiginde.

### 4.3 LIME (gorsel)

- Ne yapar: Superpixel seviyesinde lokal surrogate model kurar.
- Ne zaman iyi: Vaka bazli "lokal" aciklama raporu istendiginde.
- Dikkat: Superpixel segmentasyonu sonuca cok etki eder.

## 5) SHAP ve ozellik katkisi

### 5.1 KernelSHAP / DeepSHAP (gorsel uyarlama)

- Ne yapar: Ozellik (piksel/superpixel) katkilarini oyun teorisi tabanli hesaplar.
- Artisi: Pozitif/negatif katkilar net ayrilir.
- Eksisi: Yuksek boyutlu goruntulerde agir olabilir.

### 5.2 Multi-modal SHAP

- Ne yapar: Goruntu + hasta metadatasi (yas, HbA1c, tansiyon, vb) birlikte kullaniliyorsa ortak katkilar.
- Klinik degeri: Hekime "goruntu mu, klinik veri mi daha baskin" sorusunu aciklar.

## 6) Konsept tabanli aciklanabilirlik (klinige en yakin katman)

### 6.1 TCAV (Testing with Concept Activation Vectors)

- Ne yapar: "Mikroanevrizma", "eksuda", "hemoraji", "optik disk" gibi insan-anlasilir konseptlerin skora etkisini olcer.
- Klinik degeri: Piksel yerine klinik kavramlarla aciklama sunar.
- Gereksinim: Konsept ornek setleri ve iyi etiketleme.

### 6.2 Concept Bottleneck Models

- Ne yapar: Model once konseptleri tahmin eder, sonra final taniyi bu konseptlerden cikarir.
- Artisi: En yuksek yorumlanabilirlik.
- Eksisi: Egitim ve veri etiketleme maliyeti yuksek.

## 7) Karsit-ornek (counterfactual) aciklamalar

### 7.1 Visual Counterfactuals

- Ne yapar: "Bu goruntu hangi minimal degisimle baska sinifa gecerdi?" sorusunu yanitlar.
- Klinik degeri: Sinir vakalari anlamada cok etkilidir.
- Risk: Uretilen degisimlerin medikal gerceklige uygun olmasi gerekir.

### 7.2 Prototip ve benzer vaka aciklamasi

- Ne yapar: Karari destekleyen benzer egitim vakalarini gosterir.
- Klinik degeri: "Bu vaka su onceki vakalara benziyor" seklinde guven arttirir.

## 8) Belirsizlik ve guvenilirlik katmani (XAI + uncertainty)

### 8.1 MC Dropout / Deep Ensemble

- Ne yapar: Tahmin dagilimini olcer, epistemik belirsizlik verir.
- Klinik degeri: Heatmap guzel olsa bile modelin emniyetini ayri raporlar.

### 8.2 Calibration (Temperature Scaling, ECE, Brier)

- Ne yapar: Olasiliklarin gercek dogrulukla uyumunu olcer/duzeltir.
- Klinik degeri: "0.90 guven" gercekten 0.90 mi sorusunu cevaplar.

### 8.3 OOD (Out-of-Distribution) tespiti

- Ne yapar: Egitim dagilimi disi goruntu (farkli cihaz, kalite, patoloji dagilimi) algilar.
- Klinik degeri: Supheli girdilerde "temkinli" mod.

## 9) Segmentasyon destekli aciklama (retina icin cok guclu)

### 9.1 Anatomik segmentasyon ile dogrulama

- Ne yapar: Optik disk, makula, damar agi, lezyon maskeleri ile heatmap ortusmesini olcer.
- Metrikler: IoU, Dice, lesion hit rate, pointing game.
- Klinik degeri: Aciklamanin klinik anatomiye uyup uymadigini sayisal olarak kanitlar.

### 9.2 Lezyon-duzeyi aciklama

- Ne yapar: "Mikroanevrizma bolgesi skora +0.18 katkı" gibi bolge bazli raporlar.
- Klinik degeri: Doktor icin en anlamli formatlardan biri.

## 10) Coklu-yontem birlesik XAI stratejisi

Pratikte en iyi sonuclar tek yontemle degil, asagidaki gibi katmanli bir yapiyla alinir:

1. Birincil heatmap: Grad-CAM++ veya Score-CAM
2. Piksel atribusyon: Integrated Gradients + SmoothGrad
3. Nedensel kontrol: Occlusion sensitivity
4. Klinik anlam katmani: TCAV veya segmentasyon ortusmesi
5. Guven katmani: calibration + uncertainty + OOD

Bu kombinasyon hem muhendislik hem klinik guvenilirlik acisindan profesyonel seviyedir.

## 11) Aciklamalari degerlendirme metrikleri (zorunlu kalite katmani)

### 11.1 Faithfulness

- Deletion/Insertion AUC
- AOPC (Area Over the Perturbation Curve)
- ROAR/KAR (Remove and Retrain)

### 11.2 Localization

- Pointing Game
- IoU/Dice (lezyon maskeleri varsa)

### 11.3 Stability

- Benzer goruntulerde aciklama tutarliligi
- Augmentation altinda aciklama drift analizi

### 11.4 Human-grounded degerlendirme

- Uzman hekim puanlamasi
- Inter-rater uyumu (Cohen kappa)

## 12) Klinik urun seviyesinde raporlama oneri formati

Her vaka icin tek bir heatmap yerine su format daha profesyoneldir:

- Model tahmini + kalibre edilmis guven
- Birincil aciklama haritasi (Grad-CAM++/Score-CAM)
- Dogrulama haritasi (IG veya Occlusion)
- Klinik konsept katkisi (TCAV/segmentasyon)
- Belirsizlik ve OOD bayragi
- "Model bu karardan ne kadar emin" ve "aciklama ne kadar guvenilir" ozeti

## 13) Retina/DR ozel pratik notlar

- Fundus aciklamalarinda damar yapilari ve optik disk yaniltici sekilde yuksek aktivasyon alabilir; bu nedenle lesion-aware degerlendirme yapilmalidir.
- Sadece gorsel olarak guzel heatmap kabul edilmemeli; deletion/insertion gibi nedensel testler ile desteklenmelidir.
- Sinif dengesizligi (ozellikle ileri evreler) aciklama kalitesini bozabilir; sinif bazli XAI kalite raporu alinmalidir.
- Cihazlar arasi domain farki (kamera, aydinlatma, FOV) hem performansi hem aciklamayi etkiler; merkezler arasi validasyon gerekir.

## 14) "En profesyonel" yol haritasi (uygulanabilir sira)

1. Mevcut Grad-CAM'i koru, yanina Grad-CAM++ ekle.
2. IG + SmoothGrad ile ikinci bagimsiz aciklama kanali kur.
3. Occlusion testleri ile faithfulness olc.
4. Eger mumkunse lezyon/ROI maskeleriyle localization metrikleri ekle.
5. Calibration + uncertainty + OOD katmanini zorunlu rapora al.
6. Klinik panel ile insan-degerlendirmeli pilot calisma yap.

Bu siralama, sadece "heatmap gosteren" bir sistemi, klinikte savunulabilir aciklanabilir AI seviyesine tasir.

## 15) Ozet

Evet, heatmap'ten daha profesyonel bir seviyeye cikmak mumkun ve hatta klinik kullanim icin gereklidir. En dogru yaklasim, tek bir XAI yontemi secmek degil; CAM + attribution + perturbation + concept + uncertainty katmanlarini birlikte kullanmaktir.

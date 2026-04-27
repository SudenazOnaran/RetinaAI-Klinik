# Eğitim veri satırı: `TrainingDatasetEntry`

Bu belge, veritabanındaki **`TrainingDatasetEntry`** tablosunun ne işe yaradığını, kod yazmadan okuyan birinin genel resmi çıkarabilmesi için özetler. Amaç: ileride makine öğrenmesi / istatistiksel model eğitimi yapılırken **hangi kaydın ne anlama geldiğini** anlamak.

---

## Bu tablo ne?

- Her satır, sistemde **kaydedilmiş bir fundus analizi** (`Analysis`) ile **bire bir** eşleşir (`analysisId` benzersizdir).
- “Ham hasta kartı” değil; **eğitim ve veri dışa aktarma** için üretilmiş, **özet + yapılandırılmış etiketler** içeren bir **türetilmiş kayıttır**.
- Asıl klinik detayın büyük kısmı hâlâ **`Analysis`** tablosundadır; bu tablo özellikle **etiket (DR, bulgular, DME)** ve **metin/JSON özetleri** için düzenlenmiştir.

Silinen bir analiz olursa, ilişki nedeniyle bu eğitim satırı da **cascade** ile silinir.

---

## Alanlar (sütunlar) — kısa sözlük

| Alan                               | Anlamı (genel)                                                                                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`id`**                           | Bu eğitim satırının tekil kimliği.                                                                                                                                                                             |
| **`analysisId`**                   | Bağlı olduğu `Analysis` kaydının kimliği (her analiz için en fazla bir satır).                                                                                                                                 |
| **`originalImageUrl`**             | Eğitimde kullanılacak fundus görüntüsüne giden **depolama yolu / URL** (anonimleştirme ve dışa aktarım için referans).                                                                                         |
| **`drFeedback`**                   | **Eğitimde kullanılan DR etiketi** (Türkçe depo formundaki metin). Genelde doktor düzeltmesi; yoksa AI ile uyumlu onaylanmış etiket. İdeal olarak eğitimde **boş olmamalı**.                                   |
| **`doctorNotesText`**              | Rapor metinlerinin (doktor notları, klinik değerlendirme, muayene, tedavi önerileri vb.) **birleştirilmiş düz metin** özeti; doğal dil işleme veya kural tabanlı çıkarım için.                                 |
| **`doctorNote`**                   | `Analysis.doctorNote` ile aynı: **`manual_report_v2`** yapısında JSON (rapor başlığı, tarih, bölümler, AI özeti vb.). Yapılandırılmış raporun tam yansıması.                                                   |
| **`inferenceSnapshotJson`**        | AI çıktısının eğitim için saklanan özeti (**`training_snapshot_v2`**): görüntüden mi, metinden mi türetildiği gibi **kaynak bilgisi** ile birlikte. Ayrıntılı şema: `src/lib/dataset/training-snapshot-v2.ts`. |
| **`doctorNotesDerivedDrGradeInt`** | Doktor notları / klinik metinlerden **kural veya parse** ile çıkarılan DR evresi: 0 sağlıklı, 1 hafif, 2 orta, 3 şiddetli, 4 PDR benzeri ölçek (proje tanımına göre).                                          |
| **`microaneurysmCountLevel`**      | Mikroanevrizma yükü: **0** yok, **1** az/yerel, **2** yaygın (AI/fundus yapısından türetilir).                                                                                                                 |
| **`hemorrhageQuadrants`**          | Hemorajinin **kaç kadranda** olduğuna dair 0–4 arası özet.                                                                                                                                                     |
| **`hardExudateMacula`**            | Maküler sert eksüda veya makula yakını eksüda için **0/1** bayrak.                                                                                                                                             |
| **`cottonWoolSpots`**              | Yumuşak eksüda (CWS) için sayısal özet (proje kurallarına göre 0/1 veya seviye).                                                                                                                               |
| **`venousBeading`**                | Venöz beading bulgusu (sayısal özet).                                                                                                                                                                          |
| **`irma`**                         | IRMA bulgusu (sayısal özet).                                                                                                                                                                                   |
| **`neovascularization`**           | Neovaskülarizasyon bulgusu (sayısal özet).                                                                                                                                                                     |
| **`trainingDmeSuspected`**         | **Diyabetik maküler ödem şüphesi** için 0/1; kurallar, fundus değerlendirmesi ve API’deki DME bilgisi ile uyumlu.                                                                                              |
| **`updatedAt`**                    | Satırın son güncellenme zamanı (otomatik).                                                                                                                                                                     |

---

## Veri nasıl doluyor?

1. **Klinik akış:** Hekim raporu kaydettiğinde (`save-analysis` benzeri sunucu işlemi) hem `Analysis` güncellenir hem de varsa **`TrainingDatasetEntry`** oluşturulur veya güncellenir; AI çıktısı, notlar ve etiketler buraya işlenir.
2. **Geçmiş kayıtlar:** Eski analizler için alanlar boş kalmış olabilir; bunları doldurmak üzere projede **backfill** betikleri kullanılabilir (`backfill-training-entry-features` vb.) — bunlar `Analysis` + `aiInferenceJson` üzerinden ML sütunlarını yeniden hesaplar.

---

## Eğitim için pratik anlamı

- **Hedef etiket (sınıflandırma):** Çoğu senaryoda **`drFeedback`** veya türetilmiş **`doctorNotesDerivedDrGradeInt`**.
- **Çok etiketli / bulgu sütunları:** `microaneurysmCountLevel`, `hemorrhageQuadrants`, `neovascularization`, `trainingDmeSuspected` vb. — ikili veya sıralı modeller için.
- **Öğretmen metni / çok modlu:** `doctorNotesText`, `doctorNote`, `inferenceSnapshotJson` — metin tabanlı veya görüntü+metin birleşik eğitim için ham madde.
- **Görüntü:** `originalImageUrl` üzerinden dosya sistemi veya dışa aktarılmış veri seti ile eşleştirme.

---

## İlgili dosyalar (isteğe bağlı derinleşme)

| Konu                         | Konum (repo içi)                                                           |
| ---------------------------- | -------------------------------------------------------------------------- |
| Eğitim anlık görüntü şeması  | `apps/web/src/lib/dataset/training-snapshot-v2.ts`                         |
| ML sütunlarının hesaplanması | `apps/web/src/lib/dataset/training-entry-features.ts`                      |
| Veri dışa aktarma            | `apps/web/scripts/export-training-dataset-entries.js` (ve ilgili betikler) |
| Şema tanımı                  | `apps/web/prisma/schema.prisma` → `TrainingDatasetEntry`                   |

---

## Özet cümle

**`TrainingDatasetEntry`**, her kayıtlı analiz için “**bu örnekte eğitimde kullanılacak etiket, metin özeti, AI özeti ve fundus bulgu bayrakları neler?**” sorusunun tek satırda toplanmış halidir; tam klinik rapor **`Analysis`** ve ilişkili tablolarda kalır.

---

_Bu belge, `TrainingDatasetEntry` modelinin anlatım amaçlı özetidir; üretim şeması için her zaman `schema.prisma` ve güncel migration’lar esas alınmalıdır._

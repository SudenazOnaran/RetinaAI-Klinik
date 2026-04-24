# Veri seti yönetişimi (RetinaAI)

Bu belge, LLM veya servis çıktılarından üretilen eğitim verisinin kullanım ilkelerini özetler. Hukuki ve kurumsal onaylar kurumunuza göre tamamlanmalıdır.

## Operasyonel öncelik (şu an)

- **Canlı triyaj:** Gemini tabanlı analiz (`app_gemini.py`) ile devam; yerel multitask model **ikinci planda**, ağırlık dosyası hazır olunca açılır.
- **Veri birikimi:** Orijinal görüntüyle kayıtta `TrainingDatasetEntry` oluşur (snapshot + DR/DME etiketleri); heatmap, komorbidite, belirsizlik ve doktor yapılandırması **`Analysis`** üzerinde kalır, export’ta join edilir. **DME:** `goldDmeSuspected` / `goldDmeConfidence` (eğitim satırında snapshot’tan). **Komorbidite / belirsizlik:** `Analysis`. **Rapor metinleri:** `Analysis` ayrı sütunlar; `doctorNote` = `manual_report_v2` JSON. **Export:** `--csv` ile `gold_dme_*`, `uncertainty_score`, `comorbidity_json` (Analysis’ten).

## 1. Kişisel veri ve KVKK

- Fundus görüntüleri ve hasta kimliği **kişisel sağlık verisi** sayılabilir.
- Dışa aktarımda **`--anonymize`** kullanıldığında ham `patient_id` JSONL’e yazılmaz; bunun yerine `patient_id_anonymized` (tuzlu hash) kullanılır. Gerçek kimlik eşlemesi ayrı ve kısıtlı ortamda tutulmalıdır.
- `EXPORT_PATIENT_SALT` üretimde güçlü ve gizli tutulmalı; repoya konmamalıdır.
- Hasta/doktor **aydınlatılmış onayı** ve amaç sınırlaması (sadece model geliştirme gibi) dokümante edilmelidir.

## 2. Pseudo-etiket vs altın etiket

| Kaynak | Anlam | Eğitimde kullanım |
|--------|--------|-------------------|
| `pseudo_label` / `pseudo_dr_grade_int` | LLM veya önceki model çıktısı | Zayıf etiket; dağıtım öncesi insan denetimi önerilir |
| `human_label.dr_feedback_stored` dolu | Doktor düzeltmesi | **Tercih edilen hedef sınıf** kaynağı |
| `human_label.gold_dr_grade_int` | Kayıtlı metinlerden türetilen evre | Geri bildirim yoksa `aiResult` ile uyumlu tahmin |
| `recommended_training_grade` | Export script’in birleşik önerisi | Hızlı deneyler; politika kurumunuza göre netleştirilmeli |

Klinik karar desteği ürününde **sadece pseudo-etiketle** eğitilmiş modelleri canlıya almadan önce doğrulama çalışması yapılmalıdır.

## 3. Saklama ve erişim

- `Analysis.aiInferenceJson` ve nesne depolama yolları sunucu disk/veritabanında tutulur; erişim rolleri ve yedekleme politikası tanımlı olmalıdır.
- Eğitim paketleri (`exports/dataset-*`) şifreli ortamda ve süre sınırlı saklanabilir; gereksiz kopyalar silinmelidir.

## 4. Sürümleme

- `datasetSchemaVersion` ve Gemini tarafında `GEMINI_PROMPT_VERSION` / `inference.promptVersion` prompt veya model değişiminde güncellenmeli; karışık sürümlerle eğitimden kaçınılmalıdır.

## 5. Mevcut onay modeli (uygulama)

- `KvkkConsent` ve `KvkkProcessingLog` tabloları hasta bazlı onay ve işleme kayıtları için kullanılabilir; veri seti export işleri bu kayıtlarla uyumlu sürdürülmelidir.

## 6. `TrainingDatasetEntry` (eğitim satırı)

- **Satırda yalnızca:** `originalImageUrl`, `drFeedback`, `inferenceSnapshotJson` (`training_snapshot_v2`). `from_image` içinde `fundus_findings` (BCE) + **`fundus_assessment`** (`fundus_assessment_v1`: MA, hemoraji, eksuda, CWS, VB, IRMA, NV, kadran, 4-2-1, makula, DME dolaylı, yoğunluk, fundustan kesin değerlendirilemeyenler). Doktor düzeltmesi `doctorStructuredReview` / serbest notlar `Analysis` üzerinde; ileride aynı şema ile hizalanabilir.
- **Analysis’te:** klinik rapor, heatmap, komorbidite, `aiInferenceJson` (ham istemci snapshot), `doctorStructuredReview`, vb.; export’ta join.
- Dışa aktarma: `node scripts/export-training-dataset-entries.js` → `task: full_analysis_snapshot_v1`; manifest `samplesWithInferenceSnapshot` / `samplesMissingInferenceSnapshot` sayar.
- **Multitask eğitim** (`train_multitask_fundus_mvp.py`): yalnızca `fundus_findings` alanı export’ta olan satırlar kullanılır. **DR-only:** `recommended_training_grade` yeterli.
- Train/val ayrımı export sonrası script veya `--ml-slim` + `patient_bucket` ile yapılır; kötü örnekleri `Analysis`/satır silerek veya ayrı liste ile dışarıda bırakın.

/**
 * TrainingDatasetEntry.inferenceSnapshotJson -> export JSONL alanlari.
 * - training_snapshot_v2: from_image / from_teacher_text / provenance
 * - legacy: Analysis.aiInferenceJson (schemaVersion "1") ile uyumlu duz yapi
 *
 * train_multitask_fundus_mvp: fundus_findings, dme_suspected, dme_confidence, recommended_training_grade
 */

function isRecord(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * @param {unknown} raw Prisma Json / null
 * @returns {{
 *   ai_inference_snapshot: Record<string, unknown> | null,
 *   flat: Record<string, unknown>,
 *   inference_snapshot_present: boolean,
 *   training_v2: { gold_index: number | null, teacher_index: number | null, label_quality: string, ai_confidence_at_save: number | null } | null,
 * }}
 */
function extractInferenceForExport(raw) {
  if (!isRecord(raw)) {
    return {
      ai_inference_snapshot: null,
      flat: {},
      inference_snapshot_present: false,
      training_v2: null,
    };
  }

  if (raw.version === "training_snapshot_v2" && isRecord(raw.from_image)) {
    const fi = raw.from_image;
    const drg = isRecord(fi.dr_grade) ? fi.dr_grade : {};
    const gold = Number(drg.gold_index);
    const teacher = Number(drg.teacher_index);
    const flat = {};
    if (Number.isInteger(gold) && gold >= 0 && gold <= 4) {
      flat.dr_grade_int = gold;
    }
    if (Number.isInteger(teacher) && teacher >= 0 && teacher <= 4) {
      flat.teacher_dr_grade_int = teacher;
    }
    if (typeof drg.label_en === "string") flat.dr_label_en = drg.label_en;
    if (typeof drg.label_tr === "string") flat.dr_label_tr = drg.label_tr;
    const dme = isRecord(fi.dme) ? fi.dme : {};
    if (typeof dme.suspected === "boolean") flat.dme_suspected = dme.suspected;
    if (
      typeof dme.confidence === "number" &&
      Number.isFinite(dme.confidence)
    ) {
      flat.dme_confidence = dme.confidence;
    }
    if (isRecord(fi.fundus_findings)) {
      flat.fundus_findings = { ...fi.fundus_findings };
    }
    if (isRecord(fi.fundus_assessment)) {
      flat.fundus_assessment = JSON.parse(JSON.stringify(fi.fundus_assessment));
    }
    const ft = isRecord(raw.from_teacher_text) ? raw.from_teacher_text : {};
    if (typeof ft.clinical_reasoning_tr === "string") {
      flat.clinical_reasoning_tr = ft.clinical_reasoning_tr;
    }
    if (typeof ft.uncertainty_note === "string") {
      flat.uncertainty_note = ft.uncertainty_note;
    }
    if (isRecord(ft.clinical_decision)) {
      flat.clinical_decision = ft.clinical_decision;
    }
    if (isRecord(ft.odir)) flat.odir = ft.odir;
    const prov = isRecord(raw.provenance) ? raw.provenance : {};
    if (isRecord(prov.pytorch)) flat.pytorch_meta = prov.pytorch;
    if (isRecord(prov.llm)) flat.llm_meta = prov.llm;
    const training_v2 = {
      gold_index:
        Number.isInteger(gold) && gold >= 0 && gold <= 4 ? gold : null,
      teacher_index:
        Number.isInteger(teacher) && teacher >= 0 && teacher <= 4
          ? teacher
          : null,
      label_quality:
        typeof prov.label_quality === "string" ? prov.label_quality : "weak",
      ai_confidence_at_save:
        typeof prov.ai_confidence_at_save === "number"
          ? prov.ai_confidence_at_save
          : null,
    };
    const hasSnapshot =
      (Number.isInteger(gold) && gold >= 0 && gold <= 4) ||
      flat.fundus_findings !== undefined ||
      flat.dme_suspected !== undefined;
    return {
      ai_inference_snapshot: { ...raw },
      flat,
      inference_snapshot_present: hasSnapshot,
      training_v2,
    };
  }

  const inf = raw;
  const flat = {};

  if (isRecord(inf.fundusFindings)) {
    flat.fundus_findings = { ...inf.fundusFindings };
  }
  if (isRecord(inf.fundusAssessment)) {
    flat.fundus_assessment = JSON.parse(JSON.stringify(inf.fundusAssessment));
  }
  if (typeof inf.dmeSuspected === "boolean") {
    flat.dme_suspected = inf.dmeSuspected;
  }
  if (
    typeof inf.dmeConfidence === "number" &&
    Number.isFinite(inf.dmeConfidence)
  ) {
    flat.dme_confidence = inf.dmeConfidence;
  }
  if (typeof inf.clinicalReasoning === "string") {
    flat.clinical_reasoning_tr = inf.clinicalReasoning;
  }
  if (isRecord(inf.clinicalDecision)) {
    flat.clinical_decision = inf.clinicalDecision;
  }
  if (typeof inf.uncertaintyNote === "string") {
    flat.uncertainty_note = inf.uncertaintyNote;
  }
  if (
    typeof inf.uncertaintyScore === "number" &&
    Number.isFinite(inf.uncertaintyScore)
  ) {
    flat.uncertainty_score = inf.uncertaintyScore;
  }
  if (isRecord(inf.odir)) {
    flat.odir = inf.odir;
  }
  if (typeof inf.drLabel === "string") {
    flat.dr_label_en = inf.drLabel;
  }
  if (isRecord(inf.pytorch)) {
    flat.pytorch_meta = inf.pytorch;
  }
  if (isRecord(inf.inference)) {
    flat.llm_meta = inf.inference;
  }

  const drOk =
    Number.isInteger(inf.drGrade) && inf.drGrade >= 0 && inf.drGrade <= 4;
  if (drOk && flat.fundus_findings === undefined) {
    flat.fundus_findings = {};
  }

  const hasSnapshot =
    drOk || Object.keys(flat).length > 0 || isRecord(inf.fundusFindings);

  return {
    ai_inference_snapshot: { ...inf },
    flat,
    inference_snapshot_present: hasSnapshot,
    training_v2: null,
  };
}

module.exports = { extractInferenceForExport, isRecord };

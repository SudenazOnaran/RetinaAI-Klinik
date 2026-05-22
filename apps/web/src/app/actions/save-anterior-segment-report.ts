"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent } from "@/lib/audit-log";
import { saveDataObject } from "@/lib/object-storage";
import {
  decodeModalityAiAlignedLabel,
  decodeOctMultiSelection,
  isDoctorApprovalToken,
  modalityDrFeedbackForStorage,
} from "@/lib/doctor-feedback";
import { ANALYSIS_NOTES_MAX_LEN } from "@/lib/dataset/analysis-report-sections";
import {
  ANTERIOR_SEGMENT_DISEASE_KEYS,
  pickHighestAnteriorSegmentDisease,
} from "@/lib/modality-risk-surface";
import { buildAnteriorSegmentTextForReport } from "@/lib/anterior-segment-feedback-display";
import { getRequestLocale, getRequestMessages } from "@/lib/i18n/server";

const FEEDBACK_MAX = 4000;
const SUMMARY_MAX = 2000;

export type AnteriorSegmentReportRow = {
  id: string;
  imageUrl: string;
  aiSummary: string | null;
  aiTextSummary: string | null;
  anteriorSegmentDrFeedback: string | null;
  analysisNotes: string | null;
  urgentReferralNeeded: boolean;
  fileName: string | null;
  createdAt: string;
  patient: { id: string; fullName: string } | null;
};

function sanitizeFeedback(raw: string): string | null {
  const t = modalityDrFeedbackForStorage(raw);
  if (!t) return null;
  if (t.length > FEEDBACK_MAX) return null;

  if (isDoctorApprovalToken(t)) {
    const aligned = decodeModalityAiAlignedLabel(t);
    return aligned ?? "ai_sonucu_dogru";
  }

  const multi = decodeOctMultiSelection(t);
  if (multi.length > 0) {
    const allowed = new Set<string>(
      ANTERIOR_SEGMENT_DISEASE_KEYS.map((k) => k.value),
    );
    if (!multi.every((c) => allowed.has(c))) return null;
    return t;
  }

  const allowedSingle = new Set<string>(
    ANTERIOR_SEGMENT_DISEASE_KEYS.map((k) => k.value),
  );
  if (allowedSingle.has(t)) return t;

  return null;
}

export async function listAnteriorSegmentReportsAction(): Promise<
  | { ok: true; reports: AnteriorSegmentReportRow[] }
  | { ok: false; error: string }
> {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return { ok: false, error: "Oturum bulunamadi." };
  }

  const rows = await prisma.anteriorSegmentReport.findMany({
    where: { doctorId: session.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      imageUrl: true,
      aiSummary: true,
      aiTextSummary: true,
      anteriorSegmentDrFeedback: true,
      analysisNotes: true,
      urgentReferralNeeded: true,
      fileName: true,
      createdAt: true,
      patient: { select: { id: true, fullName: true } },
    },
  });

  return {
    ok: true,
    reports: rows.map((r: (typeof rows)[number]) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function saveAnteriorSegmentReportAction(input: {
  imageDataUrl: string;
  aiPayload: Record<string, unknown>;
  doctorFeedback: string;
  analysisNotes?: string;
  fileName?: string;
  patientId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return { ok: false, error: "Oturum bulunamadi." };
  }

  const messages = await getRequestMessages();
  const locale = await getRequestLocale();
  const t = (key: string) => {
    const parts = key.split(".");
    let cur: unknown = messages;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    return typeof cur === "string" ? cur : key;
  };

  const imageDataUrl = String(input.imageDataUrl || "").trim();
  if (!imageDataUrl.startsWith("data:")) {
    return { ok: false, error: messages.anteriorSegmentHistory.errors.noImage };
  }

  const rawPayload = input.aiPayload;
  if (!rawPayload || typeof rawPayload !== "object") {
    return {
      ok: false,
      error: messages.anteriorSegmentHistory.errors.noAiResult,
    };
  }

  const sanitizedFeedback = sanitizeFeedback(String(input.doctorFeedback || ""));
  if (!sanitizedFeedback) {
    return {
      ok: false,
      error: messages.anteriorSegmentHistory.errors.feedbackRequired,
    };
  }

  const notes = String(input.analysisNotes || "")
    .trim()
    .slice(0, ANALYSIS_NOTES_MAX_LEN);

  let patientId: string | null = String(input.patientId || "").trim() || null;
  if (patientId) {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, doctorId: session.id },
      select: { id: true },
    });
    if (!patient) patientId = null;
  }

  const payload = rawPayload as {
    imageQuality?: { qualityScore?: number; issues?: string[] };
    detectedFindings?: string[];
    diseaseAssessment?: {
      disease: string;
      status: string;
      confidence: number;
      supportingFindings?: string[];
      evaluatedStructures?: string[];
    }[];
    urgentReferralNeeded?: boolean;
    urgentReasons?: string[];
    overallSummary?: string;
  };

  const normalized = {
    imageQuality: {
      qualityScore: Number(payload.imageQuality?.qualityScore ?? 0),
      issues: Array.isArray(payload.imageQuality?.issues)
        ? payload.imageQuality!.issues!.map(String)
        : [],
    },
    detectedFindings: Array.isArray(payload.detectedFindings)
      ? payload.detectedFindings.map(String)
      : [],
    diseaseAssessment: Array.isArray(payload.diseaseAssessment)
      ? payload.diseaseAssessment.map((d) => ({
          disease: String(d.disease || ""),
          status: String(d.status || ""),
          confidence: Number(d.confidence ?? 0),
          supportingFindings: Array.isArray(d.supportingFindings)
            ? d.supportingFindings.map(String)
            : [],
          evaluatedStructures: Array.isArray(d.evaluatedStructures)
            ? d.evaluatedStructures.map(String)
            : [],
        }))
      : [],
    urgentReferralNeeded: Boolean(payload.urgentReferralNeeded),
    urgentReasons: Array.isArray(payload.urgentReasons)
      ? payload.urgentReasons.map(String)
      : [],
    overallSummary: String(payload.overallSummary || "").trim(),
  };

  const primary = pickHighestAnteriorSegmentDisease(normalized.diseaseAssessment);
  const aiSummary = (
    primary?.disease?.trim() ||
    normalized.overallSummary ||
    t("modalityDisagree.anteriorSegment.as_healthy")
  ).slice(0, SUMMARY_MAX);

  const aiTextSummary = buildAnteriorSegmentTextForReport(
    normalized,
    notes,
    t as (k: string) => string,
  );

  try {
    const stored = await saveDataObject({
      doctorId: session.id,
      patientId: patientId ?? "anterior-segment",
      category: "anterior-segment",
      dataUrlOrBase64: imageDataUrl,
    });

    const created = await prisma.anteriorSegmentReport.create({
      data: {
        doctorId: session.id,
        patientId,
        imageUrl: stored.url,
        aiSummary,
        aiTextSummary,
        aiInferenceJson: normalized as unknown as Prisma.InputJsonValue,
        anteriorSegmentDrFeedback: sanitizedFeedback,
        analysisNotes: notes || null,
        urgentReferralNeeded: normalized.urgentReferralNeeded,
        fileName: String(input.fileName || "").trim().slice(0, 260) || null,
      },
      select: { id: true },
    });

    await logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "CREATE",
      entityType: "ANALYSIS",
      entityId: created.id,
      description: "On segment analiz raporu kaydedildi",
      metadata: {
        kind: "anterior-segment",
        patientId,
        locale,
      },
    });

    return { ok: true, id: created.id };
  } catch {
    return {
      ok: false,
      error: messages.anteriorSegmentHistory.errors.saveFailed,
    };
  }
}

export async function deleteAnteriorSegmentReportAction(
  reportId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return { ok: false, error: "Oturum bulunamadi." };
  }

  const id = String(reportId || "").trim();
  if (!id) {
    return { ok: false, error: "Gecersiz kayit." };
  }

  const deleted = await prisma.anteriorSegmentReport.deleteMany({
    where: { id, doctorId: session.id },
  });

  if (deleted.count === 0) {
    return { ok: false, error: "Kayit bulunamadi." };
  }

  return { ok: true };
}

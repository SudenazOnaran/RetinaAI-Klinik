import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

export type IntegrationTarget = "FHIR" | "HBYS";
export type IntegrationStatus = "SUCCESS" | "FAILED";

type PatientWithLatestAnalysis = {
  id: string;
  doctorId: string;
  fullName: string;
  tcNo: string;
  age: number;
  gender: string | null;
  diabetesYears: number | null;
  hba1c: number | null;
  risk: string;
  latestAnalysis: {
    id: string;
    aiResult: string;
    confidence: number;
    drFeedback: string | null;
    doctorNote: string | null;
    actualResult: string | null;
    createdAt: Date;
  } | null;
};

export type IntegrationEventRow = {
  id: string;
  doctorId: string;
  patientId: string;
  target: IntegrationTarget;
  status: IntegrationStatus;
  httpStatus: number | null;
  errorMessage: string | null;
  responsePayload: unknown;
  createdAt: Date;
  patientFullName: string;
};

export async function ensureIntegrationTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "IntegrationEvent" (
      "id" TEXT NOT NULL,
      "doctorId" TEXT NOT NULL,
      "patientId" TEXT NOT NULL,
      "target" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "httpStatus" INTEGER,
      "errorMessage" TEXT,
      "requestPayload" JSONB,
      "responsePayload" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "IntegrationEvent_doctorId_createdAt_idx"
    ON "IntegrationEvent"("doctorId", "createdAt" DESC);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "IntegrationEvent_patientId_idx"
    ON "IntegrationEvent"("patientId");
  `);
}

export async function getPatientForIntegration(
  doctorId: string,
  patientId: string,
): Promise<PatientWithLatestAnalysis | null> {
  const patient = await prisma.patient.findFirst({
    where: {
      id: patientId,
      doctorId,
    },
    include: {
      analyses: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!patient) {
    return null;
  }

  const latest = patient.analyses[0] ?? null;

  return {
    id: patient.id,
    doctorId: patient.doctorId,
    fullName: patient.fullName,
    tcNo: patient.tcNo,
    age: patient.age,
    gender: patient.gender,
    diabetesYears: patient.diabetesYears,
    hba1c: patient.hba1c,
    risk: patient.risk,
    latestAnalysis: latest
      ? {
          id: latest.id,
          aiResult: latest.aiResult,
          confidence: latest.confidence,
          drFeedback: latest.drFeedback,
          doctorNote: latest.doctorNote,
          actualResult: latest.actualResult,
          createdAt: latest.createdAt,
        }
      : null,
  };
}

function normalizeName(input: string) {
  return input
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
}

function splitName(fullName: string) {
  const parts = normalizeName(fullName);
  if (parts.length <= 1) {
    return { given: [fullName], family: fullName };
  }

  const family = parts[parts.length - 1];
  const given = parts.slice(0, -1);
  return { family, given };
}

function resolveClinicalResult(patient: PatientWithLatestAnalysis) {
  const analysis = patient.latestAnalysis;
  if (!analysis) return null;

  const doctorFeedback = String(analysis.drFeedback || "").trim();
  if (
    doctorFeedback &&
    !["ai sonucu doğru", "dogru", "doğru", "correct", "yes"].includes(
      doctorFeedback.toLocaleLowerCase("tr-TR"),
    )
  ) {
    return doctorFeedback;
  }

  return analysis.actualResult || analysis.aiResult;
}

export function buildFhirBundle(
  patient: PatientWithLatestAnalysis,
  doctorName: string,
) {
  const result = resolveClinicalResult(patient);
  const patientName = splitName(patient.fullName);
  const nowIso = new Date().toISOString();

  const entries: Array<Record<string, unknown>> = [
    {
      resource: {
        resourceType: "Patient",
        id: `retina-${patient.id}`,
        identifier: [
          {
            system: "https://retina.local/tc",
            value: patient.tcNo,
          },
        ],
        name: [
          {
            use: "official",
            family: patientName.family,
            given: patientName.given,
          },
        ],
        gender:
          patient.gender?.toLocaleLowerCase("tr-TR") === "erkek"
            ? "male"
            : patient.gender?.toLocaleLowerCase("tr-TR") === "kadın"
              ? "female"
              : "unknown",
        extension: [
          {
            url: "https://retina.local/fhir/StructureDefinition/age",
            valueInteger: patient.age,
          },
          {
            url: "https://retina.local/fhir/StructureDefinition/risk",
            valueString: patient.risk,
          },
        ],
      },
    },
  ];

  if (patient.latestAnalysis) {
    entries.push({
      resource: {
        resourceType: "Observation",
        id: `retina-analysis-${patient.latestAnalysis.id}`,
        status: "final",
        category: [
          {
            coding: [
              {
                system:
                  "http://terminology.hl7.org/CodeSystem/observation-category",
                code: "exam",
                display: "Exam",
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: "https://retina.local/codes",
              code: "fundus-dr-screening",
              display: "Diabetic Retinopathy AI Screening",
            },
          ],
          text: "Fundus DR Analizi",
        },
        subject: {
          reference: `Patient/retina-${patient.id}`,
        },
        effectiveDateTime: patient.latestAnalysis.createdAt.toISOString(),
        performer: [
          {
            display: doctorName,
          },
        ],
        valueString: result || "Belirtilmedi",
        note: patient.latestAnalysis.doctorNote
          ? [{ text: patient.latestAnalysis.doctorNote }]
          : undefined,
        component: [
          {
            code: {
              text: "AI Confidence",
            },
            valueQuantity: {
              value: Number(patient.latestAnalysis.confidence || 0),
              unit: "score",
            },
          },
          {
            code: {
              text: "HbA1c",
            },
            valueQuantity: {
              value: Number(patient.hba1c || 0),
              unit: "%",
            },
          },
        ],
      },
    });
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: nowIso,
    entry: entries,
  };
}

export function buildHbysPayload(
  patient: PatientWithLatestAnalysis,
  doctorName: string,
) {
  const result = resolveClinicalResult(patient);

  return {
    kaynak: "retina-clinic",
    gonderimTarihi: new Date().toISOString(),
    hasta: {
      id: patient.id,
      tcNo: patient.tcNo,
      adSoyad: patient.fullName,
      yas: patient.age,
      cinsiyet: patient.gender,
      diyabetSuresiYil: patient.diabetesYears,
      hba1c: patient.hba1c,
      risk: patient.risk,
    },
    analiz: patient.latestAnalysis
      ? {
          analizId: patient.latestAnalysis.id,
          tarih: patient.latestAnalysis.createdAt.toISOString(),
          aiSonucu: patient.latestAnalysis.aiResult,
          finalSonuc: result,
          guvenSkoru: Number(patient.latestAnalysis.confidence || 0),
          doktorNotu: patient.latestAnalysis.doctorNote,
        }
      : null,
    doktor: {
      adSoyad: doctorName,
      doktorId: patient.doctorId,
    },
  };
}

function getIntegrationEndpoint(target: IntegrationTarget) {
  if (target === "FHIR") {
    return process.env.FHIR_EXPORT_URL || process.env.FHIR_BASE_URL || "";
  }

  return process.env.HBYS_EXPORT_URL || process.env.HBYS_BASE_URL || "";
}

function getIntegrationAuthHeader(target: IntegrationTarget) {
  if (target === "FHIR") {
    const token = process.env.FHIR_AUTH_TOKEN;
    if (!token) return null;
    return { Authorization: `Bearer ${token}` };
  }

  const apiKey = process.env.HBYS_API_KEY;
  if (!apiKey) return null;
  return { "X-Api-Key": apiKey };
}

export async function sendToIntegration(
  target: IntegrationTarget,
  payload: unknown,
) {
  const endpoint = getIntegrationEndpoint(target);

  if (!endpoint) {
    return {
      ok: false,
      status: 503,
      response: {
        error: `${target} endpoint ayari eksik`,
      },
    };
  }

  try {
    const headers = new Headers({
      "Content-Type": "application/json",
    });

    const authHeader = getIntegrationAuthHeader(target);
    if (authHeader) {
      Object.entries(authHeader).forEach(([key, value]) => {
        headers.set(key, value);
      });
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    const text = await res.text();
    let parsed: unknown = text;

    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Yanit JSON degilse oldugu gibi sakla.
    }

    return {
      ok: res.ok,
      status: res.status,
      response: parsed,
    };
  } catch (error) {
    return {
      ok: false,
      status: 504,
      response: {
        error:
          error instanceof Error
            ? error.message
            : "Entegrasyon baglantisinda hata olustu",
      },
    };
  }
}

export async function writeIntegrationEvent(input: {
  doctorId: string;
  patientId: string;
  target: IntegrationTarget;
  status: IntegrationStatus;
  httpStatus: number | null;
  errorMessage?: string | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
}) {
  await ensureIntegrationTables();

  await prisma.$executeRaw`
    INSERT INTO "IntegrationEvent" (
      "id",
      "doctorId",
      "patientId",
      "target",
      "status",
      "httpStatus",
      "errorMessage",
      "requestPayload",
      "responsePayload",
      "createdAt"
    )
    VALUES (
      ${randomUUID()},
      ${input.doctorId},
      ${input.patientId},
      ${input.target},
      ${input.status},
      ${input.httpStatus},
      ${input.errorMessage ?? null},
      ${JSON.stringify(input.requestPayload ?? null)}::jsonb,
      ${JSON.stringify(input.responsePayload ?? null)}::jsonb,
      CURRENT_TIMESTAMP
    )
  `;
}

export async function getRecentIntegrationEvents(
  doctorId: string,
  limit = 30,
): Promise<IntegrationEventRow[]> {
  await ensureIntegrationTables();

  const rows = await prisma.$queryRaw<IntegrationEventRow[]>`
    SELECT
      ie."id",
      ie."doctorId",
      ie."patientId",
      ie."target",
      ie."status",
      ie."httpStatus",
      ie."errorMessage",
      ie."responsePayload",
      ie."createdAt",
      p."fullName" AS "patientFullName"
    FROM "IntegrationEvent" ie
    LEFT JOIN "Patient" p ON p."id" = ie."patientId"
    WHERE ie."doctorId" = ${doctorId}
    ORDER BY ie."createdAt" DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `;

  return rows;
}

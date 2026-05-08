import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDoctorSession } from "@/lib/auth-session";

interface PatientPayload {
  offlineId: string;
  fullName: string;
  tcNo: string;
  age: number;
  risk?: string;
  diabetesYears?: number | null;
  gender?: string | null;
  hba1c?: number | null;
}

interface AnalysisPayload {
  offlineId: string;
  patientId: string; // Offline veya server ID olabilir
  aiResult: string;
  confidence: number;
  heatmapUrl?: string | null;
  originalImage?: string | null;
  doctorNote?: string | null;
}

export async function POST(req: Request) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = await req.json() as {
    patients?: PatientPayload[];
    analyses?: AnalysisPayload[];
  };

  const patientMapping: Record<string, string> = {};
  const analysisMapping: Record<string, string> = {};

  // 1. Önce hastalar — sıralı çünkü analizler hasta ID'ye bağlı
  if (Array.isArray(body.patients)) {
    for (const p of body.patients) {
      try {
        const created = await prisma.patient.create({
          data: {
            doctorId: session.id,
            fullName: String(p.fullName ?? ""),
            tcNo: String(p.tcNo ?? ""),
            age: Number(p.age ?? 0),
            risk: p.risk ?? "Yok",
            diabetesYears: p.diabetesYears != null ? Number(p.diabetesYears) : null,
            gender: p.gender ?? null,
            hba1c: p.hba1c != null ? Number(p.hba1c) : null,
          },
        });
        patientMapping[p.offlineId] = created.id;
      } catch {
        // Kayıt hatası — mapping'e ekleme, client retry eder
      }
    }
  }

  // 2. Sonra analizler — hasta ID mapping uygulanır
  if (Array.isArray(body.analyses)) {
    for (const a of body.analyses) {
      try {
        // Offline hasta ID'sini server ID'ye çevir (veya zaten server ID ise kullan)
        const resolvedPatientId = patientMapping[a.patientId] ?? a.patientId;

        // Hastanın bu doktora ait olduğunu doğrula
        const patient = await prisma.patient.findFirst({
          where: { id: resolvedPatientId, doctorId: session.id },
        });
        if (!patient) continue;

        const created = await prisma.analysis.create({
          data: {
            patientId: resolvedPatientId,
            aiResult: String(a.aiResult ?? ""),
            confidence: Number(a.confidence ?? 0),
            heatmapUrl: a.heatmapUrl ?? null,
            originalImage: a.originalImage ?? null,
            doctorNote: a.doctorNote ?? null,
          },
        });
        analysisMapping[a.offlineId] = created.id;
      } catch {
        // Kayıt hatası — devam
      }
    }
  }

  return NextResponse.json({
    patients: { mapping: patientMapping },
    analyses: { mapping: analysisMapping },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { buildRetinaReportPdfInputFromDb } from "@/lib/retina-report-db-payload";
import { inlineRetinaReportStorageImagesForPdf } from "@/lib/pdf-inline-storage-images";
import { buildRetinaReportPdfWithPuppeteer } from "@/lib/retina-report-puppeteer-pdf";
import {
  getDefaultRetinaSettings,
  normalizeRetinaSettings,
  type RetinaSettings,
} from "@/lib/retina-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Puppeteer + font yükleme için süre */
export const maxDuration = 120;

type Body = {
  patientId?: string;
  reportId?: string;
  pdfVariant?: "clinical" | "radiological";
  pdfLocale?: "tr" | "en";
};

export async function POST(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Gecersiz JSON" }, { status: 400 });
  }

  const patientId = String(body.patientId || "").trim();
  const reportId = String(body.reportId || "").trim();
  if (!patientId || !reportId) {
    return NextResponse.json(
      { error: "patientId ve reportId zorunludur" },
      { status: 400 },
    );
  }

  const pdfVariant =
    body.pdfVariant === "radiological" ? "radiological" : "clinical";
  const pdfLocale = body.pdfLocale === "en" ? "en" : "tr";

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, doctorId: session.id },
    include: { doctor: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Hasta bulunamadi" }, { status: 404 });
  }

  const analysis = await prisma.analysis.findFirst({
    where: { id: reportId, patientId },
  });

  if (!analysis) {
    return NextResponse.json({ error: "Rapor bulunamadi" }, { status: 404 });
  }

  const doctorSettingsRow = await prisma.doctorSettings.findUnique({
    where: { doctorId: session.id },
  });

  const mergedSettings: RetinaSettings = normalizeRetinaSettings(
    (doctorSettingsRow?.settings as Partial<RetinaSettings> | undefined) ??
      getDefaultRetinaSettings(),
  );

  const pdfInput = buildRetinaReportPdfInputFromDb({
    patient,
    analysis,
    pdfVariant,
    pdfLocale,
    retinaSettingsSnapshot: mergedSettings,
  });

  const pdfInputWithImages =
    await inlineRetinaReportStorageImagesForPdf(pdfInput);

  try {
    const { pdf, fileName } =
      await buildRetinaReportPdfWithPuppeteer(pdfInputWithImages);
    const buf = Buffer.from(pdf);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report.pdf"`,
        "X-Retina-File-Name": encodeURIComponent(fileName),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("doctor/report/pdf Puppeteer", err);
    return NextResponse.json(
      { error: "PDF olusturulamadi" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { resolveObjectPathFromKey } from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getRequestId,
  logError,
  logInfo,
  requestIdHeaders,
} from "@/lib/structured-logger";

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function inferContentType(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const requestId = getRequestId(req);
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json(
      { error: "Oturum bulunamadi" },
      { status: 401, headers: requestIdHeaders(requestId) },
    );
  }

  const { key } = await context.params;

  if (key.length < 4) {
    return NextResponse.json(
      { error: "Gecersiz object key" },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  const ownerDoctorId = key[0];
  const patientId = key[1];
  const expectedDoctorSegment = sanitizeSegment(session.id);

  if (ownerDoctorId !== expectedDoctorSegment) {
    return NextResponse.json(
      { error: "Bu dosyaya erisim yetkiniz yok" },
      { status: 403, headers: requestIdHeaders(requestId) },
    );
  }

  if (patientId !== "unknown") {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        doctorId: session.id,
      },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "Bu dosyaya erisim yetkiniz yok" },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }
  }

  const fullPath = resolveObjectPathFromKey(key);
  if (!fullPath) {
    return NextResponse.json(
      { error: "Gecersiz dosya yolu" },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  try {
    const data = await fs.readFile(fullPath);

    void logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "DOWNLOAD",
      entityType: "ANALYSIS",
      entityId: patientId === "unknown" ? null : patientId,
      description: "Object storage dosyasi indirildi",
      metadata: {
        objectKey: key.join("/"),
        patientId: patientId === "unknown" ? null : patientId,
      },
    });

    logInfo({
      message: "storage_object_download",
      requestId,
      route: "/api/storage/object/[...key]",
      doctorId: session.id,
      metadata: {
        objectKey: key.join("/"),
      },
    });

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": inferContentType(fullPath),
        "Cache-Control": "private, max-age=300",
        ...requestIdHeaders(requestId),
      },
    });
  } catch (error) {
    logError({
      message: "storage_object_download_failed",
      requestId,
      route: "/api/storage/object/[...key]",
      doctorId: session.id,
      metadata: {
        objectKey: key.join("/"),
      },
      error,
    });

    return NextResponse.json(
      { error: "Dosya bulunamadi" },
      { status: 404, headers: requestIdHeaders(requestId) },
    );
  }
}

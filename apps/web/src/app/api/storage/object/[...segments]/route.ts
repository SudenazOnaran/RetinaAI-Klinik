import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import {
  resolveObjectPathFromKey,
  sanitizeSegment,
} from "@/lib/object-storage";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getRequestId,
  logError,
  logInfo,
  requestIdHeaders,
} from "@/lib/structured-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mimeFromFilename(fp: string): string {
  const ext = path.extname(fp).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".bmp") return "image/bmp";
  return "application/octet-stream";
}

export async function GET(
  req: Request,
  context: { params: Promise<{ segments: string[] }> },
) {
  const requestId = getRequestId(req);
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json(
      { error: "Oturum bulunamadi" },
      { status: 401, headers: requestIdHeaders(requestId) },
    );
  }

  const params = await context.params;
  const raw = params.segments ?? [];
  if (raw.length === 0) {
    return NextResponse.json(
      { error: "Bad request" },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  const decoded = raw.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  });

  if (decoded.length < 4) {
    return NextResponse.json(
      { error: "Gecersiz object key" },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  const ownerDoctorId = decoded[0]!;
  const patientId = decoded[1]!;
  const expectedDoctorSegment = sanitizeSegment(session.id);
  const managerBypass = isRoleAllowed(session.role, ["MANAGER"]);

  if (!managerBypass) {
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
  }

  const fullPath = resolveObjectPathFromKey(decoded);
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
        objectKey: decoded.join("/"),
        patientId: patientId === "unknown" ? null : patientId,
      },
    });

    logInfo({
      message: "storage_object_download",
      requestId,
      route: "/api/storage/object/[...segments]",
      doctorId: session.id,
      metadata: {
        objectKey: decoded.join("/"),
      },
    });

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": mimeFromFilename(fullPath),
        "Cache-Control": "private, max-age=300",
        ...requestIdHeaders(requestId),
      },
    });
  } catch (error) {
    logError({
      message: "storage_object_download_failed",
      requestId,
      route: "/api/storage/object/[...segments]",
      doctorId: session.id,
      metadata: {
        objectKey: decoded.join("/"),
      },
      error,
    });

    return NextResponse.json(
      { error: "Dosya bulunamadi" },
      { status: 404, headers: requestIdHeaders(requestId) },
    );
  }
}

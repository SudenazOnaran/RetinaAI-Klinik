import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  formatErrorCause,
  logStructuredError,
} from "@/lib/structured-error-log";

type QueueRow = {
  id: string;
  status: string;
  endpoint: string;
  error: string | null;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET(req: Request) {
  const requestId = req.headers.get("x-request-id")?.trim() || randomUUID();

  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER", "AUDITOR"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(100, Number(searchParams.get("limit") || 25)),
  );

  try {
    const rows = await prisma.$queryRaw<QueueRow[]>`
      SELECT "id", "status", "endpoint", "error", "attempts", "createdAt", "updatedAt"
      FROM "AiRequestQueue"
      WHERE "doctorId" = ${session.id}
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({
      success: true,
      rows: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logStructuredError({
      requestId,
      route: "/api/ai/queue",
      action: "AI_QUEUE_LIST",
      errorMessage:
        error instanceof Error ? error.message : "AI kuyruk okunamadi",
      stack: error instanceof Error ? error.stack : undefined,
      cause: formatErrorCause(error),
      payloadSummary: JSON.stringify({ limit }),
    });
    return NextResponse.json(
      { success: false, error: "Kuyruk okunamadi." },
      { status: 500 },
    );
  }
}

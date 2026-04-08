import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { logAuditEvent, type AuditAction } from "@/lib/audit-log";

const ALLOWED_ACTIONS: AuditAction[] = [
  "VIEW",
  "EDIT",
  "APPROVE",
  "DOWNLOAD",
  "CREATE",
  "DELETE",
];

export async function POST(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  const body = (await req.json()) as {
    action?: AuditAction;
    entityType?:
      | "PATIENT"
      | "ANALYSIS"
      | "REPORT"
      | "SETTINGS"
      | "CALENDAR"
      | "SYSTEM";
    entityId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.action || !ALLOWED_ACTIONS.includes(body.action)) {
    return NextResponse.json({ error: "Gecersiz action" }, { status: 400 });
  }

  if (!body.entityType) {
    return NextResponse.json({ error: "entityType gerekli" }, { status: 400 });
  }

  await logAuditEvent({
    doctorId: session.id,
    role: session.role,
    action: body.action,
    entityType: body.entityType,
    entityId: body.entityId ?? null,
    description: body.description,
    metadata: body.metadata,
  });

  return NextResponse.json({ success: true });
}

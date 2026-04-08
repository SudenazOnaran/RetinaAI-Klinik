import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { logAuditEvent } from "@/lib/audit-log";
import { restoreObjectStorageBackup } from "@/lib/object-storage";
import {
  getRequestId,
  logError,
  logInfo,
  requestIdHeaders,
} from "@/lib/structured-logger";

type RestoreBody = {
  backupDir?: string;
  dryRun?: boolean;
};

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const session = await getCurrentDoctorSession();
    if (!session) {
      return NextResponse.json(
        { error: "Oturum bulunamadi" },
        { status: 401, headers: requestIdHeaders(requestId) },
      );
    }

    if (!isRoleAllowed(session.role, ["MANAGER"])) {
      return NextResponse.json(
        { error: "Yetkiniz yok" },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const body = (await request.json().catch(() => ({}))) as RestoreBody;
    const restore = await restoreObjectStorageBackup({
      backupDir: body.backupDir,
      dryRun: body.dryRun,
    });

    await logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "EDIT",
      entityType: "SYSTEM",
      description: restore.dryRun
        ? "Object storage restore dry-run calistirildi"
        : "Object storage restore calistirildi",
      metadata: {
        backupDir: restore.backupDir,
        dryRun: restore.dryRun,
        fileCount: restore.fileCount,
        durationMs: restore.durationMs,
        rpoHours: restore.rpoHours,
      },
    });

    logInfo({
      message: "storage_restore_completed",
      requestId,
      route: "/api/storage/backup/restore",
      doctorId: session.id,
      metadata: {
        dryRun: restore.dryRun,
        backupDir: restore.backupDir,
        durationMs: restore.durationMs,
        rpoHours: restore.rpoHours,
      },
    });

    return NextResponse.json(
      {
        success: true,
        restore,
      },
      { headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    logError({
      message: "storage_restore_failed",
      requestId,
      route: "/api/storage/backup/restore",
      error,
    });

    return NextResponse.json(
      { error: "Restore islemi basarisiz" },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

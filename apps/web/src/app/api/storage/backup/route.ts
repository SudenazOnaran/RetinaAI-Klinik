import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { createObjectStorageBackup } from "@/lib/object-storage";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getRequestId,
  logError,
  logInfo,
  requestIdHeaders,
} from "@/lib/structured-logger";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const session = await getCurrentDoctorSession();
    if (!session) {
      return NextResponse.json(
        { error: "Oturum bulunamadı" },
        { status: 401, headers: requestIdHeaders(requestId) },
      );
    }

    if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
      return NextResponse.json(
        { error: "Yetkiniz yok" },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const backup = await createObjectStorageBackup();

    await logAuditEvent({
      doctorId: session.id,
      role: session.role,
      action: "EDIT",
      entityType: "SYSTEM",
      description: "Object storage yedekleme işlemi çalıştırıldı",
      metadata: {
        backupDir: backup.backupDir,
      },
    });

    logInfo({
      message: "storage_backup_created",
      requestId,
      route: "/api/storage/backup",
      doctorId: session.id,
      metadata: {
        backupDir: backup.backupDir,
      },
    });

    return NextResponse.json(
      {
        success: true,
        backupDir: backup.backupDir,
        manifest: backup.manifest,
      },
      { headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    logError({
      message: "storage_backup_failed",
      requestId,
      route: "/api/storage/backup",
      error,
    });

    return NextResponse.json(
      { error: "Yedekleme başarısız" },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }
}

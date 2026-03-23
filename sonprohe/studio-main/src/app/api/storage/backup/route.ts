import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import { createObjectStorageBackup } from "@/lib/object-storage";
import { logAuditEvent } from "@/lib/audit-log";

export async function POST() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const backup = await createObjectStorageBackup();

  await logAuditEvent({
    doctorId: session.id,
    role: session.role,
    action: "EDIT",
    entityType: "SYSTEM",
    description: "Object storage yedekleme islemi calistirildi",
    metadata: {
      backupDir: backup.backupDir,
    },
  });

  return NextResponse.json({
    success: true,
    backupDir: backup.backupDir,
    manifest: backup.manifest,
  });
}

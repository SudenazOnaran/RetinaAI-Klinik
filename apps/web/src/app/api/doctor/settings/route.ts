import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import {
  getDefaultRetinaSettings,
  normalizeRetinaSettings,
  RetinaSettings,
} from "@/lib/retina-settings";

type DoctorSettingsRow = {
  settings: unknown;
  updatedAt: Date;
};

export async function GET() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const rows = await prisma.$queryRaw<DoctorSettingsRow[]>`
    SELECT "settings", "updatedAt"
    FROM "DoctorSettings"
    WHERE "doctorId" = ${session.id}
    LIMIT 1
  `;

  const row = rows[0] ?? null;

  const settings = normalizeRetinaSettings(
    (row?.settings as Partial<RetinaSettings> | undefined) ??
      getDefaultRetinaSettings(),
  );

  return NextResponse.json({
    success: true,
    settings,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  });
}

export async function PUT(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as { settings?: Partial<RetinaSettings> };
  const normalized = normalizeRetinaSettings(body.settings);

  const rows = await prisma.$queryRaw<DoctorSettingsRow[]>`
    INSERT INTO "DoctorSettings" (
      "id",
      "doctorId",
      "settings",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${session.id},
      ${session.id},
      ${JSON.stringify(normalized)}::jsonb,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("doctorId")
    DO UPDATE SET
      "settings" = EXCLUDED."settings",
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "settings", "updatedAt"
  `;

  const saved = rows[0];

  return NextResponse.json({
    success: true,
    settings: normalizeRetinaSettings(
      saved.settings as Partial<RetinaSettings>,
    ),
    updatedAt: saved.updatedAt.toISOString(),
  });
}

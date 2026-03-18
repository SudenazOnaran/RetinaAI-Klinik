import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import {
  getDefaultRetinaSettings,
  normalizeRetinaSettings,
  RetinaSettings,
} from "@/lib/retina-settings";

export async function GET() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  const prismaRuntime = prisma as unknown as {
    doctorSettings: {
      findUnique: (
        args: unknown,
      ) => Promise<{ settings: unknown; updatedAt: Date } | null>;
      upsert: (
        args: unknown,
      ) => Promise<{ settings: unknown; updatedAt: Date }>;
    };
  };

  const row = await prismaRuntime.doctorSettings.findUnique({
    where: { doctorId: session.id },
    select: { settings: true, updatedAt: true },
  });

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

  const body = (await req.json()) as { settings?: Partial<RetinaSettings> };
  const normalized = normalizeRetinaSettings(body.settings);

  const prismaRuntime = prisma as unknown as {
    doctorSettings: {
      upsert: (
        args: unknown,
      ) => Promise<{ settings: unknown; updatedAt: Date }>;
    };
  };

  const saved = await prismaRuntime.doctorSettings.upsert({
    where: { doctorId: session.id },
    update: { settings: normalized },
    create: {
      doctorId: session.id,
      settings: normalized,
    },
    select: {
      settings: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    settings: normalizeRetinaSettings(
      saved.settings as Partial<RetinaSettings>,
    ),
    updatedAt: saved.updatedAt.toISOString(),
  });
}

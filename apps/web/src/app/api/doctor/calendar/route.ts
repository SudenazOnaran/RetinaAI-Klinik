import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { randomUUID } from "node:crypto";
import { isRoleAllowed } from "@/lib/roles";

type CalendarPayload = {
  id?: string;
  dateKey?: string;
  time?: string;
  title?: string;
  note?: string;
};

function isValidDateKey(value: string | undefined): value is string {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value: string | undefined): value is string {
  if (!value) return false;
  return /^\d{2}:\d{2}$/.test(value);
}

type CalendarEventRow = {
  id: string;
  dateKey: string;
  time: string;
  title: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "ASSISTANT", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const events =
    month && /^\d{4}-\d{2}$/.test(month)
      ? await prisma.$queryRaw<CalendarEventRow[]>`
        SELECT "id", "dateKey", "time", "title", "note", "createdAt", "updatedAt"
        FROM "CalendarEvent"
        WHERE "doctorId" = ${session.id}
          AND "dateKey" >= ${`${month}-01`}
          AND "dateKey" < ${`${month}-32`}
        ORDER BY "dateKey" ASC, "time" ASC, "createdAt" ASC
      `
      : await prisma.$queryRaw<CalendarEventRow[]>`
        SELECT "id", "dateKey", "time", "title", "note", "createdAt", "updatedAt"
        FROM "CalendarEvent"
        WHERE "doctorId" = ${session.id}
        ORDER BY "dateKey" ASC, "time" ASC, "createdAt" ASC
      `;

  return NextResponse.json({ success: true, events });
}

export async function POST(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "ASSISTANT", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as CalendarPayload;
  const dateKey = body.dateKey?.trim();
  const time = body.time?.trim();
  const title = body.title?.trim();
  const note = body.note?.trim();

  if (!isValidDateKey(dateKey) || !isValidTime(time) || !title || !note) {
    return NextResponse.json(
      { error: "Geçersiz takvim verisi" },
      { status: 400 },
    );
  }

  const conflicting = await prisma.$queryRaw<
    Array<{ id: string; title: string }>
  >`
    SELECT "id", "title"
    FROM "CalendarEvent"
    WHERE "doctorId" = ${session.id}
      AND "dateKey" = ${dateKey}
      AND "time" = ${time}
    LIMIT 1
  `;

  if (conflicting.length > 0) {
    return NextResponse.json(
      {
        error: "Aynı saatte başka bir görev zaten var",
        conflict: conflicting[0],
      },
      { status: 409 },
    );
  }

  const eventId = randomUUID();

  const rows = await prisma.$queryRaw<CalendarEventRow[]>`
    INSERT INTO "CalendarEvent" (
      "id",
      "doctorId",
      "dateKey",
      "time",
      "title",
      "note",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${eventId},
      ${session.id},
      ${dateKey},
      ${time},
      ${title},
      ${note},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    RETURNING "id", "dateKey", "time", "title", "note", "createdAt", "updatedAt"
  `;

  const event = rows[0];

  return NextResponse.json({ success: true, event });
}

export async function PUT(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "ASSISTANT", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as CalendarPayload;
  const id = body.id?.trim();
  const dateKey = body.dateKey?.trim();
  const time = body.time?.trim();
  const title = body.title?.trim();
  const note = body.note?.trim();

  if (
    !id ||
    !isValidDateKey(dateKey) ||
    !isValidTime(time) ||
    !title ||
    !note
  ) {
    return NextResponse.json(
      { error: "Geçersiz takvim verisi" },
      { status: 400 },
    );
  }

  const conflicting = await prisma.$queryRaw<
    Array<{ id: string; title: string }>
  >`
    SELECT "id", "title"
    FROM "CalendarEvent"
    WHERE "doctorId" = ${session.id}
      AND "dateKey" = ${dateKey}
      AND "time" = ${time}
      AND "id" <> ${id}
    LIMIT 1
  `;

  if (conflicting.length > 0) {
    return NextResponse.json(
      {
        error: "Aynı saatte başka bir görev zaten var",
        conflict: conflicting[0],
      },
      { status: 409 },
    );
  }

  const rows = await prisma.$queryRaw<CalendarEventRow[]>`
    UPDATE "CalendarEvent"
    SET
      "dateKey" = ${dateKey},
      "time" = ${time},
      "title" = ${title},
      "note" = ${note},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
      AND "doctorId" = ${session.id}
    RETURNING "id", "dateKey", "time", "title", "note", "createdAt", "updatedAt"
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ success: true, event: rows[0] });
}

export async function DELETE(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "ASSISTANT", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as { id?: string };
  const id = body.id?.trim();

  if (!id) {
    return NextResponse.json({ error: "Kayıt id gerekli" }, { status: 400 });
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    DELETE FROM "CalendarEvent"
    WHERE "id" = ${id}
      AND "doctorId" = ${session.id}
    RETURNING "id"
  `;

  const deletedCount = rows.length;

  if (deletedCount === 0) {
    return NextResponse.json({ error: "Kayıt bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id });
}

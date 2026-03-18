import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentDoctorSession } from "@/lib/auth-session";

type CalendarPayload = {
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

export async function GET(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");

  const where =
    month && /^\d{4}-\d{2}$/.test(month)
      ? {
          doctorId: session.id,
          dateKey: {
            gte: `${month}-01`,
            lt: `${month}-32`,
          },
        }
      : { doctorId: session.id };

  const prismaRuntime = prisma as unknown as {
    calendarEvent: {
      findMany: (args: unknown) => Promise<
        Array<{
          id: string;
          dateKey: string;
          time: string;
          title: string;
          note: string;
          createdAt: Date;
          updatedAt: Date;
        }>
      >;
      create: (args: unknown) => Promise<{
        id: string;
        dateKey: string;
        time: string;
        title: string;
        note: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  };

  const events = await prismaRuntime.calendarEvent.findMany({
    where,
    orderBy: [{ dateKey: "asc" }, { time: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      dateKey: true,
      time: true,
      title: true,
      note: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, events });
}

export async function POST(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  const body = (await req.json()) as CalendarPayload;
  const dateKey = body.dateKey?.trim();
  const time = body.time?.trim();
  const title = body.title?.trim();
  const note = body.note?.trim();

  if (!isValidDateKey(dateKey) || !isValidTime(time) || !title || !note) {
    return NextResponse.json(
      { error: "Gecersiz takvim verisi" },
      { status: 400 },
    );
  }

  const prismaRuntime = prisma as unknown as {
    calendarEvent: {
      create: (args: unknown) => Promise<{
        id: string;
        dateKey: string;
        time: string;
        title: string;
        note: string;
        createdAt: Date;
        updatedAt: Date;
      }>;
    };
  };

  const event = await prismaRuntime.calendarEvent.create({
    data: {
      doctorId: session.id,
      dateKey,
      time,
      title,
      note,
    },
    select: {
      id: true,
      dateKey: true,
      time: true,
      title: true,
      note: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ success: true, event });
}

export async function DELETE(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  const body = (await req.json()) as { id?: string };
  const id = body.id?.trim();

  if (!id) {
    return NextResponse.json({ error: "Kayit id gerekli" }, { status: 400 });
  }

  const prismaRuntime = prisma as unknown as {
    calendarEvent: {
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  };

  const deleted = await prismaRuntime.calendarEvent.deleteMany({
    where: {
      id,
      doctorId: session.id,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Kayit bulunamadi" }, { status: 404 });
  }

  return NextResponse.json({ success: true, id });
}

import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { isRoleAllowed } from "@/lib/roles";
import {
  buildPilotMetricSummary,
  createPilotMetricSnapshot,
  createPilotMetricEvent,
  getPilotMetricEvents,
  getPilotMetricSnapshots,
  type PilotMetricDirection,
  type PilotMetricKey,
} from "@/lib/pilot-metrics";

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toPilotCsv(input: {
  doctorId: string;
  events: Awaited<ReturnType<typeof getPilotMetricEvents>>;
}) {
  const headers = [
    "doctorId",
    "metricKey",
    "metricLabel",
    "direction",
    "baselineValue",
    "currentValue",
    "unit",
    "sampleSize",
    "periodStart",
    "periodEnd",
    "createdAt",
    "improvementPercent",
    "note",
  ];

  const rows = input.events.map((row) => {
    const improvement =
      row.baselineValue === 0
        ? null
        : row.direction === "LOWER_IS_BETTER"
          ? ((row.baselineValue - row.currentValue) / row.baselineValue) * 100
          : ((row.currentValue - row.baselineValue) / row.baselineValue) * 100;

    return [
      input.doctorId,
      row.metricKey,
      row.metricLabel,
      row.direction,
      row.baselineValue,
      row.currentValue,
      row.unit,
      row.sampleSize,
      row.periodStart.toISOString(),
      row.periodEnd.toISOString(),
      row.createdAt.toISOString(),
      improvement === null ? "" : Math.round(improvement * 100) / 100,
      row.note || "",
    ];
  });

  return [headers, ...rows]
    .map((line) => line.map((cell) => escapeCsv(cell)).join(","))
    .join("\n");
}

export async function GET(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER", "AUDITOR"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "100");
  const format = (searchParams.get("format") || "json").toLowerCase();
  const events = await getPilotMetricEvents(session.id, limit);

  if (format === "csv") {
    const csv = toPilotCsv({ doctorId: session.id, events });
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pilot-metrikleri-${stamp}.csv"`,
      },
    });
  }

  const summary = buildPilotMetricSummary(events).map((row) => ({
    metricKey: row.metricKey,
    metricLabel: row.metricLabel,
    direction: row.direction,
    baselineValue: row.baselineValue,
    currentValue: row.currentValue,
    unit: row.unit,
    sampleSize: row.sampleSize,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    improvementPercent: row.improvementPercent,
  }));

  const snapshots = await getPilotMetricSnapshots(session.id, 12);

  return NextResponse.json({
    success: true,
    summary,
    snapshots: snapshots.map((row) => ({
      id: row.id,
      snapshotMonth: row.snapshotMonth,
      eventCount: row.eventCount,
      generatedAt: row.generatedAt.toISOString(),
      summary: row.summary.map((item) => ({
        ...item,
        periodStart: new Date(item.periodStart).toISOString(),
        periodEnd: new Date(item.periodEnd).toISOString(),
      })),
    })),
    events: events.map((row) => ({
      ...row,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      createdAt: row.createdAt.toISOString(),
      improvementPercent:
        row.baselineValue === 0
          ? null
          : row.direction === "LOWER_IS_BETTER"
            ? ((row.baselineValue - row.currentValue) / row.baselineValue) * 100
            : ((row.currentValue - row.baselineValue) / row.baselineValue) *
              100,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  if (!isRoleAllowed(session.role, ["DOCTOR", "MANAGER"])) {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  const body = (await req.json()) as {
    action?: "CREATE_EVENT" | "CREATE_SNAPSHOT";
    metricKey?: PilotMetricKey;
    metricLabel?: string;
    direction?: PilotMetricDirection;
    baselineValue?: number;
    currentValue?: number;
    unit?: string;
    sampleSize?: number;
    periodStart?: string;
    periodEnd?: string;
    note?: string;
    snapshotMonth?: string;
  };

  if (body.action === "CREATE_SNAPSHOT") {
    const snapshot = await createPilotMetricSnapshot({
      doctorId: session.id,
      snapshotMonth: body.snapshotMonth,
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "Snapshot icin yeterli metrik kaydi yok" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      snapshotMonth: snapshot.snapshotMonth,
      eventCount: snapshot.eventCount,
    });
  }

  if (!body.metricKey || !body.metricLabel || !body.unit) {
    return NextResponse.json({ error: "Eksik metrik alani" }, { status: 400 });
  }

  const direction: PilotMetricDirection =
    body.direction === "HIGHER_IS_BETTER"
      ? "HIGHER_IS_BETTER"
      : "LOWER_IS_BETTER";

  const baselineValue = Number(body.baselineValue);
  const currentValue = Number(body.currentValue);
  const periodStart = body.periodStart ? new Date(body.periodStart) : null;
  const periodEnd = body.periodEnd ? new Date(body.periodEnd) : null;

  if (
    !Number.isFinite(baselineValue) ||
    !Number.isFinite(currentValue) ||
    !periodStart ||
    !periodEnd ||
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime())
  ) {
    return NextResponse.json(
      { error: "Gecersiz metrik degeri" },
      { status: 400 },
    );
  }

  await createPilotMetricEvent({
    doctorId: session.id,
    metricKey: body.metricKey,
    metricLabel: body.metricLabel,
    direction,
    baselineValue,
    currentValue,
    unit: body.unit,
    sampleSize: Number(body.sampleSize || 0),
    periodStart,
    periodEnd,
    note: body.note,
  });

  return NextResponse.json({ success: true });
}

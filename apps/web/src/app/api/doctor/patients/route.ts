import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileDoctorSession } from "@/lib/auth-session";

export async function GET(req: Request) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");

  const patients = await prisma.patient.findMany({
    where: {
      doctorId: session.id,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ patients });
}

export async function POST(req: Request) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const body = await req.json();
  const { fullName, tcNo, age, risk, diabetesYears, gender, hba1c } = body as Record<string, unknown>;

  if (!fullName || !tcNo || age === undefined) {
    return NextResponse.json({ error: "Eksik alan: fullName, tcNo, age zorunlu" }, { status: 400 });
  }

  const patient = await prisma.patient.create({
    data: {
      doctorId: session.id,
      fullName: String(fullName),
      tcNo: String(tcNo),
      age: Number(age),
      risk: risk ? String(risk) : "Yok",
      diabetesYears: diabetesYears != null ? Number(diabetesYears) : null,
      gender: gender ? String(gender) : null,
      hba1c: hba1c != null ? Number(hba1c) : null,
    },
  });

  return NextResponse.json({ patient }, { status: 201 });
}

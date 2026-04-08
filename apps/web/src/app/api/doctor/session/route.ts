import { NextResponse } from "next/server";
import { getCurrentDoctorSession } from "@/lib/auth-session";

export async function GET() {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    doctor: {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  });
}

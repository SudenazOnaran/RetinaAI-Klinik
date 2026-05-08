import { NextResponse } from "next/server";
import { getMobileDoctorSession } from "@/lib/auth-session";

export async function POST(req: Request) {
  const session = getMobileDoctorSession(req);
  if (!session) {
    return NextResponse.json({ success: true, valid: false }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    valid: true,
    doctor: {
      id: session.id,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  });
}

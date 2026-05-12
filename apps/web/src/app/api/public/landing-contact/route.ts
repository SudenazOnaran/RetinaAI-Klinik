import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLandingContactNotifyEmail } from "@/lib/doctor-approval-email";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function emailOk(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function digitsOnly(v: string) {
  return v.replace(/\D/g, "");
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const message = body.message != null ? String(body.message).trim() : "";
    const contactPref = body.contactPreference === "phone" ? "phone" : "email";
    const honeypot = String(body.website ?? "").trim();

    if (honeypot.length > 0) {
      return NextResponse.json({ success: true }, { status: 200, headers: CORS_HEADERS });
    }

    if (fullName.length < 2 || fullName.length > 200) {
      return NextResponse.json(
        { error: "Ad soyad en az 2 karakter olmalıdır." },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (contactPref === "email") {
      if (!email || !emailOk(email)) {
        return NextResponse.json(
          { error: "Geçerli bir e-posta adresi girin." },
          { status: 400, headers: CORS_HEADERS },
        );
      }
    } else {
      const d = digitsOnly(phone);
      if (d.length < 10 || d.length > 15) {
        return NextResponse.json(
          { error: "Geçerli bir telefon numarası girin (en az 10 rakam)." },
          { status: 400, headers: CORS_HEADERS },
        );
      }
    }

    const msg =
      message.length > 8000 ? message.slice(0, 8000) : message || null;

    await prisma.landingContactRequest.create({
      data: {
        fullName,
        email: contactPref === "email" ? email : email || null,
        phone: contactPref === "phone" ? phone : phone || null,
        message: msg,
      },
    });

    void sendLandingContactNotifyEmail({
      fullName,
      email: contactPref === "email" ? email || null : email || null,
      phone: contactPref === "phone" ? phone || null : phone || null,
      message: msg,
    }).catch((err) => {
      console.error("[landing-contact] Bildirim e-postası gönderilemedi:", err);
    });

    return NextResponse.json(
      { success: true, message: "Talebiniz alındı. En kısa sürede sizinle iletişime geçeceğiz." },
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (
      message.includes("the URL must start with the protocol `prisma://`") ||
      message.includes("prisma+postgres://")
    ) {
      return NextResponse.json(
        { error: "Servis geçici olarak kullanılamıyor." },
        { status: 503, headers: CORS_HEADERS },
      );
    }
    console.error("Landing contact POST:", e);
    return NextResponse.json(
      { error: "Sunucu hatası oluştu." },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}

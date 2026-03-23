import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import { getCurrentDoctorSession } from "@/lib/auth-session";
import { resolveObjectPathFromKey } from "@/lib/object-storage";

function inferContentType(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const session = await getCurrentDoctorSession();
  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi" }, { status: 401 });
  }

  const { key } = await context.params;
  const fullPath = resolveObjectPathFromKey(key);
  if (!fullPath) {
    return NextResponse.json({ error: "Gecersiz dosya yolu" }, { status: 400 });
  }

  try {
    const data = await fs.readFile(fullPath);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": inferContentType(fullPath),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Dosya bulunamadi" }, { status: 404 });
  }
}

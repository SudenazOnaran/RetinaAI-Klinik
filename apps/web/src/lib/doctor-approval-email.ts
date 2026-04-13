import nodemailer from "nodemailer";

function trimEnv(name: string): string {
  return (process.env[name] || "").trim();
}

export function isDoctorApprovalEmailConfigured(): boolean {
  return Boolean(
    trimEnv("SMTP_HOST") && trimEnv("SMTP_USER") && trimEnv("SMTP_PASS"),
  );
}

export function getPublicAppBaseUrl(): string {
  const raw = trimEnv("APP_BASE_URL") || trimEnv("NEXT_PUBLIC_APP_URL");
  if (raw) return raw.replace(/\/+$/, "");
  const vercel = trimEnv("VERCEL_URL");
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "http://127.0.0.1:9002";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createTransporter() {
  const host = trimEnv("SMTP_HOST");
  const port = Number.parseInt(trimEnv("SMTP_PORT") || "587", 10);
  const secureExplicit = trimEnv("SMTP_SECURE");
  const secure =
    secureExplicit === "1" ||
    secureExplicit.toLowerCase() === "true" ||
    port === 465;
  const user = trimEnv("SMTP_USER");
  const pass = trimEnv("SMTP_PASS");
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: { user, pass },
  });
}

function getFromAddress(): string {
  const from = trimEnv("SMTP_FROM");
  const user = trimEnv("SMTP_USER");
  if (from) return from;
  if (user) return `Retina AI <${user}>`;
  return "Retina AI <noreply@invalid.local>";
}

/**
 * Admin onayı sonrası doktora giriş linki içeren e-posta gönderir.
 * SMTP yapılandırması yoksa uyarı loglar ve sessizce döner.
 */
export async function sendDoctorApprovalEmail(params: {
  to: string;
  recipientFirstName?: string | null;
}): Promise<void> {
  if (!isDoctorApprovalEmailConfigured()) {
    console.warn(
      "[doctor-approval-email] SMTP atlandı: SMTP_HOST / SMTP_USER / SMTP_PASS eksik.",
    );
    console.warn("[retina-mail] SKIP missing SMTP_HOST / SMTP_USER / SMTP_PASS");
    return;
  }

  const loginUrl = `${getPublicAppBaseUrl()}/login`;
  const first = params.recipientFirstName?.trim();
  const greeting = first ? `Merhaba ${first},` : "Merhaba,";
  const subject = "Retina AI — Hesabınız onaylandı";
  const text = `${greeting}

Başvurunuz onaylanmıştır. Aşağıdaki bağlantıdan sisteme giriş yapabilirsiniz:

${loginUrl}

İyi çalışmalar,
Retina AI`;

  const safeGreeting = escapeHtml(greeting);
  const safeUrl = escapeHtml(loginUrl);
  const html = `<p>${safeGreeting}</p>
<p>Başvurunuz onaylanmıştır. Aşağıdaki bağlantıdan sisteme giriş yapabilirsiniz:</p>
<p><a href="${safeUrl}">${safeUrl}</a></p>
<p>İyi çalışmalar,<br/>Retina AI</p>`;

  const transporter = createTransporter();
  const mailOptions = {
    from: getFromAddress(),
    to: params.to,
    subject,
    text,
    html,
  };
  // ASCII-only: journalctl / grep guvenilir; Turkce karakter sorun cikarmasin
  console.error("[retina-mail] attempting send");
  try {
    await transporter.sendMail(mailOptions);
    console.error("[retina-mail] SENT ok");
  } catch (err) {
    console.error("[retina-mail] SEND failed", err);
    throw err;
  }
}

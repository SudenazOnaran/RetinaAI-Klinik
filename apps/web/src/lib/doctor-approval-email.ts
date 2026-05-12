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

/** Yeni doktor kayıt bildiriminin gideceği adres; yoksa klinik gelen kutusu. */
function getAdminRegistrationNotifyTo(): string {
  const explicit = trimEnv("ADMIN_REGISTRATION_NOTIFY_EMAIL");
  if (explicit) return explicit;
  return "retinai.klinik@gmail.com";
}

/**
 * Yeni doktor kayıt başvurusunda admin gelen kutusuna bilgi maili gönderir.
 * SMTP yoksa uyarı loglar ve sessizce döner (kayıt yine de tamamlanır).
 */
export async function sendDoctorRegistrationRequestNotifyEmail(params: {
  doctorDisplayName: string;
  doctorEmail: string;
}): Promise<void> {
  if (!isDoctorApprovalEmailConfigured()) {
    console.warn(
      "[doctor-approval-email] Kayıt bildirimi atlandı: SMTP_HOST / SMTP_USER / SMTP_PASS eksik.",
    );
    return;
  }

  const display = params.doctorDisplayName.trim() || "Bilinmeyen";
  const email = params.doctorEmail.trim();
  const adminUrl = `${getPublicAppBaseUrl()}/admin`;
  const subject = "Retina AI — Yeni doktor kayıt başvurusu";
  const text = `${display} adlı doktor kayıt başvurusu gönderdi.

E-posta: ${email}

Başvuruyu incelemek için: ${adminUrl}

Retina AI`;

  const safeDisplay = escapeHtml(display);
  const safeEmail = escapeHtml(email);
  const safeAdminUrl = escapeHtml(adminUrl);
  const mailtoHref = `mailto:${encodeURIComponent(email)}`;
  const html = `<p><strong>${safeDisplay}</strong> adlı doktor kayıt başvurusu gönderdi.</p>
<p>E-posta: <a href="${mailtoHref}">${safeEmail}</a></p>
<p>Başvuruyu incelemek için: <a href="${safeAdminUrl}">${safeAdminUrl}</a></p>
<p>Retina AI</p>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: getAdminRegistrationNotifyTo(),
    subject,
    text,
    html,
  });
  console.error("[retina-mail] registration notify SENT ok");
}

/**
 * Bize ulaşın formu gönderildiğinde admin gelen kutusuna bilgi maili gönderir.
 * SMTP yoksa uyarı loglar ve sessizce döner (kayıt yine de tamamlanır).
 */
export async function sendLandingContactNotifyEmail(params: {
  fullName: string;
  email: string | null;
  phone: string | null;
  message: string | null;
}): Promise<void> {
  if (!isDoctorApprovalEmailConfigured()) {
    console.warn(
      "[doctor-approval-email] Landing contact bildirimi atlandı: SMTP_HOST / SMTP_USER / SMTP_PASS eksik.",
    );
    return;
  }

  const adminUrl = `${getPublicAppBaseUrl()}/admin`;
  const safeName = params.fullName.trim() || "Bilinmeyen";
  const subject = "Retina AI — Yeni iletişim talebi";

  const contactLine = params.email
    ? `E-posta: ${params.email}`
    : params.phone
      ? `Telefon: ${params.phone}`
      : "İletişim bilgisi yok";

  const msgLine = params.message ? `\nMesaj:\n${params.message}\n` : "";

  const text = `${safeName} adlı kişi iletişim formu doldurdu.\n\n${contactLine}${msgLine}\nAdmin panelinden görüntülemek için: ${adminUrl}\n\nRetina AI`;

  const safeNameHtml = escapeHtml(safeName);
  const safeContactHtml = escapeHtml(contactLine);
  const safeAdminUrl = escapeHtml(adminUrl);
  const safeMsgHtml = params.message
    ? `<p><strong>Mesaj:</strong><br/>${escapeHtml(params.message).replace(/\n/g, "<br/>")}</p>`
    : "";

  const html = `<p><strong>${safeNameHtml}</strong> adlı kişi iletişim formu doldurdu.</p>
<p>${safeContactHtml}</p>
${safeMsgHtml}
<p>Admin panelinden görüntülemek için: <a href="${safeAdminUrl}">${safeAdminUrl}</a></p>
<p>Retina AI</p>`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: getFromAddress(),
    to: getAdminRegistrationNotifyTo(),
    subject,
    text,
    html,
  });
  console.error("[retina-mail] landing contact notify SENT ok");
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

# Onay sonrası kullanıcıya e-posta bildirimi (plan)

## Hedef

- Admin panelinde doktor başvurusu **onaylandığında** (`PATCH /api/admin/requests`, `action: "APPROVE"`), ilgili `Doctor.email` adresine Türkçe bir e-posta gitsin.
- İçerik: hesabın onaylandığı, giriş sayfası tam URL’si (ör. `https://…/login`).

## Teknoloji seçimi (kesin)

- **Nodemailer + SMTP** (Google Gmail SMTP).
- **Gönderen adres:** `retinai.klinik@gmail.com` (alıcıya bu hesaptan görünür).

### Gmail SMTP ayarları (referans)

| Parametre | Değer |
|-----------|--------|
| Sunucu | `smtp.gmail.com` |
| Port | `587` (STARTTLS) veya `465` (SSL) — Nodemailer’da genelde `587` + `secure: false` |
| Kullanıcı | `retinai.klinik@gmail.com` |
| Şifre | **Uygulama şifresi** (aşağıdaki adımlar). Normal Gmail şifresi SMTP ile çalışmaz. |

Üretim ve geliştirme ortamında `SMTP_PASS` olarak yalnızca bu uygulama şifresini kullanın; repoya veya istemciye koymayın.

### 2 adımlı doğrulamayı açtıktan sonra (sıradaki adım)

1. Aynı Google hesabıyla (`retinai.klinik@gmail.com`) tarayıcıda giriş yapın.
2. **[Google Hesabı → Güvenlik](https://myaccount.google.com/security)** sayfasına gidin.
3. **2 Adımlı Doğrulama** bölümünün altında **Uygulama şifreleri** seçeneğini açın.  
   - Doğrudan link: [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (bazen “Uygulama şifreleri” yalnızca 2 adım açıkken görünür).
4. Uygulama: **Posta**, cihaz: **Diğer (Özel ad)** → örn. `Retina SMTP` yazıp **Oluştur** deyin.
5. Ekranda çıkan **16 haneli şifreyi** kopyalayın (boşluksuz tek parça olarak `.env` içinde `SMTP_PASS` değerine yapıştıracaksınız).
6. Bu şifreyi bir daha gösterilmez; kaybederseniz yenisini oluşturun, eskisini silin.

> Kurumsal Google Workspace hesabında yönetici “uygulama şifrelerini” kapattıysa bu menü görünmez; o zaman yöneticiden izin veya farklı gönderim yöntemi gerekir. Standart `@gmail.com` hesaplarında yukarıdaki yol geçerlidir.

## Mimari özeti

1. Onay işlemi sunucuda `src/app/api/admin/requests/route.ts` içinde yapılıyor.
2. `APPROVE` başarılı olduktan sonra e-posta gönderen modül çağrılır (`lib/` altında, Nodemailer transporter).
3. Giriş linki: `APP_BASE_URL` veya `NEXT_PUBLIC_APP_URL` (kök URL, sondaki `/` olmadan) + **`/login`**. Boşsa geliştirmede `http://127.0.0.1:9002`, Vercel’de `VERCEL_URL` kullanılır.

## Ortam değişkenleri (`.env.example` ile aynı isimler)

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=0` (465 kullanıyorsanız `1` veya `true`)
- `SMTP_USER=retinai.klinik@gmail.com`
- `SMTP_PASS=` (Gmail uygulama şifresi)
- `SMTP_FROM=retinai.klinik@gmail.com` veya `Retina AI <retinai.klinik@gmail.com>` (boşsa `Retina AI <SMTP_USER>`)
- `APP_BASE_URL=https://sizin-alan-adiniz.com` (giriş linki için zorunlu sayılır; yoksa dev/Vercel yedekleri kullanılır)

## Adımlar (checklist)

- [x] **1. Gmail:** `retinai.klinik@gmail.com` için 2 Adımlı Doğrulama + **Uygulama şifresi** (yukarıdaki alt başlık).
- [x] **2. Env:** `.env.local` / deployment — `SMTP_*`, `SMTP_FROM`, `APP_BASE_URL`.
- [x] **3. Bağımlılık:** `nodemailer`, `@types/nodemailer` (dev).
- [x] **4. Kod:** `src/lib/doctor-approval-email.ts` — `sendDoctorApprovalEmail({ to, recipientFirstName })`, `from` = `SMTP_FROM` veya `Retina AI <SMTP_USER>`.
- [x] **5. Entegrasyon:** `src/app/api/admin/requests/route.ts` — `APPROVE` sonrası fire-and-forget; hata yalnızca log.
- [ ] **6. Test:** Admin’den gerçek onay veya eşdeğer istek; alıcı kutusu ve spam kontrolü.

## İlgili kod (referans)

- E-posta: `src/lib/doctor-approval-email.ts`
- Admin onay/red: `src/app/api/admin/requests/route.ts` — `PATCH`, `action === "APPROVE"`.
- Giriş: `src/app/login/page.tsx` → **`/login`**.

## Güncelleme günlüğü

| Tarih | Not |
|-------|-----|
| 2026-04-10 | İlk plan: hedef e-posta, sağlayıcı karşılaştırması, entegrasyon noktası. |
| 2026-04-10 | SMTP + Gmail kesin; gönderen `retina.ai.tech@gmail.com`; doküman `mail_gönderme.md` olarak netleştirildi (SMS ifadeleri kaldırıldı). |
| 2026-04-10 | Gönderen hesap `retinai.klinik@gmail.com` olarak güncellendi; 2 adım sonrası uygulama şifresi adımları eklendi. |
| 2026-04-10 | Uygulama: Nodemailer + `doctor-approval-email.ts`, admin `PATCH` entegrasyonu; env isimleri `SMTP_FROM` / `APP_BASE_URL` ile hizalandı. |

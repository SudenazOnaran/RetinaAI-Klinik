"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    if (!name || !email || !password) {
      setError("Tüm alanları doldurun.");
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/doctor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...");
        setTimeout(() => router.replace("/login"), 1500);
      } else {
        setError(data.error || "Kayıt sırasında bir hata oluştu.");
      }
    } catch {
      setError("Sunucuya bağlanırken hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="clinic-app-bg min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="clinic-panel grid w-full overflow-hidden rounded-2xl md:grid-cols-2">
          <form onSubmit={handleRegister} className="p-8 md:p-10">
            <h2 className="text-2xl font-bold text-slate-900">Doktor Kaydı</h2>
            <p className="mt-1 text-sm text-slate-600">
              Klinik sistemine yeni kullanıcı kaydı oluşturun.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  E-posta
                </label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Şifre
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--retina-primary)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--retina-primary-deep)] disabled:opacity-70"
              >
                <UserPlus className="h-4 w-4" />
                {isLoading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
              </button>
            </div>

            <div className="mt-6 text-sm text-slate-600">
              Zaten hesabınız var mı?{" "}
              <Link
                href="/login"
                className="font-semibold text-[var(--retina-secondary)] hover:text-[var(--retina-secondary-soft)]"
              >
                Giriş Yap
              </Link>
            </div>
          </form>

          <div className="hidden border-l border-[var(--retina-border)] bg-gradient-to-br from-[#6c63ff] to-[#1e90ff] p-10 text-white md:flex md:flex-col md:justify-between">
            <div>
              <p className="clinic-wood-strip inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                <Eye className="h-3.5 w-3.5" /> Retina Clinic
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight">
                Klinik Kullanıcı Yönetimi
              </h1>
              <p className="mt-3 text-sm text-blue-100">
                Sade, güvenilir ve hasta odaklı klinik sistem arayüzü.
              </p>
            </div>

            <div className="rounded-xl border border-white/25 bg-white/10 p-4 text-sm text-blue-50 backdrop-blur-sm">
              Her doktor için güvenli giriş ve ayrıştırılmış hasta erişimi.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

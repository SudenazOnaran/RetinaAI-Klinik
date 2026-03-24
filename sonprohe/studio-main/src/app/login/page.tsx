"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    // API ile giriş kontrolü
    try {
      const res = await fetch("/api/doctor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.replace("/dashboard");
      } else {
        if (
          data.errorCode === "PASSWORD_RESET_REQUIRED" ||
          data.errorCode === "TEMP_PASSWORD_EXPIRED"
        ) {
          const emailParam = encodeURIComponent(email);
          const reasonParam = encodeURIComponent(data.errorCode);
          router.push(
            `/reset-password?email=${emailParam}&reason=${reasonParam}`,
          );
          return;
        }

        if (res.status === 429) {
          const retry = Number(data.retryAfterSeconds || 0);
          if (Number.isFinite(retry) && retry > 0) {
            const minutes = Math.ceil(retry / 60);
            setError(
              `Cok fazla hatali deneme algilandi. Lutfen ${minutes} dakika sonra tekrar deneyin.`,
            );
          } else {
            setError(
              "Cok fazla hatali deneme algilandi. Lutfen daha sonra tekrar deneyin.",
            );
          }
        } else {
          setError(data.error || "Giriş başarısız");
        }
      }
    } catch {
      setError("Sunucu hatası");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="clinic-app-bg min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="clinic-panel grid w-full overflow-hidden rounded-2xl md:grid-cols-2">
          <div className="hidden border-r border-[var(--retina-border)] bg-gradient-to-br from-[#0a2540] to-[#1e90ff] p-10 text-white md:flex md:flex-col md:justify-between">
            <div>
              <p className="clinic-wood-strip inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                <Eye className="h-3.5 w-3.5" /> Retina Clinic
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight">
                Klinik Destek ve Retina Analiz Paneli
              </h1>
              <p className="mt-3 text-sm text-blue-100">
                Doktor oturumu ile güvenli erişim, sade ve modern klinik çalışma
                alanı.
              </p>
            </div>

            <div className="rounded-xl border border-white/25 bg-white/10 p-4 text-sm text-blue-50 backdrop-blur-sm">
              Göz hastalıkları takip süreçleri için optimize edilmiş kullanıcı
              deneyimi.
            </div>
          </div>

          <form onSubmit={handleLogin} className="p-8 md:p-10">
            <h2 className="text-2xl font-bold text-slate-900">Doktor Girişi</h2>
            <p className="mt-1 text-sm text-slate-600">
              Sisteme devam etmek için oturum açın.
            </p>

            <div className="mt-6 space-y-4">
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

              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--retina-primary)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--retina-primary-deep)] disabled:opacity-70"
              >
                <LogIn className="h-4 w-4" />
                {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>

              <p className="text-center text-xs text-slate-500">
                Ilk giriste veya gecici sifre suresi dolduysa{" "}
                <Link href="/reset-password" className="underline">
                  buradan sifreyi yenileyin
                </Link>
                .
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

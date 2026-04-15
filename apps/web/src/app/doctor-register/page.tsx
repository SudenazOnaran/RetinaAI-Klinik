"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, UserPlus, CheckCircle } from "lucide-react";
import { useTranslation } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default function DoctorRegisterPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hospital, setHospital] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !surname || !email || !password || !specialty || !hospital) {
      setError(t("doctorRegister.errors.requiredFields"));
      return;
    }

    if (password.length < 8) {
      setError(t("doctorRegister.errors.passwordLength"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("doctorRegister.errors.passwordMatch"));
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/doctor/public-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, surname, email, password, specialty, hospital }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsSuccess(true);
      } else {
        setError(data.error || t("doctorRegister.errors.registerFailed"));
      }
    } catch {
      setError(t("doctorRegister.errors.server"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="clinic-app-bg min-h-screen px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center justify-center">
          <div className="clinic-panel w-full rounded-2xl p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{t("doctorRegister.success.title")}</h2>
            <p className="mt-3 text-sm text-slate-600">
              {t("doctorRegister.success.description")}
            </p>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t("doctorRegister.success.pending")}
            </div>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--retina-primary)] px-6 py-2.5 font-semibold text-white hover:bg-[var(--retina-primary-deep)]"
            >
              {t("doctorRegister.success.backLogin")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clinic-app-bg min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="clinic-panel grid w-full overflow-hidden rounded-2xl md:grid-cols-2">
          <div className="hidden border-r border-[var(--retina-border)] bg-gradient-to-br from-[#006B8F] to-[#00A8CC] p-10 text-white md:flex md:flex-col md:justify-between">
            <div>
              <p className="clinic-wood-strip inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                <Eye className="h-3.5 w-3.5" /> {t("doctorRegister.side.brand")}
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight">
                {t("doctorRegister.side.title")}
              </h1>
              <p className="mt-3 text-sm text-blue-100">
                {t("doctorRegister.side.description")}
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/25 bg-white/10 p-4 text-sm text-blue-50 backdrop-blur-sm">
                <p className="font-semibold mb-2">{t("doctorRegister.side.processTitle")}</p>
                <ol className="space-y-1 text-xs text-blue-100 list-decimal list-inside">
                  <li>{t("doctorRegister.side.step1")}</li>
                  <li>{t("doctorRegister.side.step2")}</li>
                  <li>{t("doctorRegister.side.step3")}</li>
                </ol>
              </div>
            </div>
          </div>

          <form onSubmit={handleRegister} className="p-8 md:p-10">
            <div className="mb-4 flex justify-end">
              <LanguageSwitcher />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">{t("doctorRegister.form.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("doctorRegister.form.subtitle")}
            </p>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    {t("doctorRegister.form.name")}
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
                    {t("doctorRegister.form.surname")}
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("doctorRegister.form.email")}
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
                  {t("doctorRegister.form.specialty")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                  placeholder={t("doctorRegister.form.specialtyPlaceholder")}
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("doctorRegister.form.hospital")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("doctorRegister.form.password")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 pr-10 outline-none focus:border-[var(--retina-primary)]"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t("doctorRegister.form.passwordHint")}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("doctorRegister.form.confirmPassword")}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 pr-10 outline-none focus:border-[var(--retina-primary)]"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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
                <UserPlus className="h-4 w-4" />
                {isLoading ? t("doctorRegister.form.submitting") : t("doctorRegister.form.submit")}
              </button>

              <p className="text-center text-xs text-slate-500 mt-2">
                {t("doctorRegister.form.hasAccount")}{" "}
                <Link href="/login" className="underline font-semibold text-[var(--retina-primary)]">
                  {t("doctorRegister.form.login")}
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

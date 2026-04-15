"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/doctor/password/reset-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, temporaryPassword, newPassword }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setMessage(
          t("resetPassword.messages.success"),
        );
        setTemporaryPassword("");
        setNewPassword("");
      } else {
        setError(data.error || t("resetPassword.messages.updateFailed"));
      }
    } catch {
      setError(t("resetPassword.messages.server"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clinic-app-bg min-h-screen px-4 py-8">
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher />
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {t("resetPassword.title")}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t("resetPassword.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("resetPassword.email")}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("resetPassword.temporaryPassword")}
            </label>
            <input
              type="password"
              required
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {t("resetPassword.newPassword")}
            </label>
            <input
              type="password"
              required
              minLength={10}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              {t("resetPassword.passwordHint")}
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--retina-primary)] px-4 py-2.5 font-semibold text-white"
          >
            {loading ? t("resetPassword.updating") : t("resetPassword.submit")}
          </button>
        </form>

        <div className="mt-4 text-sm">
          <Link
            href="/login"
            className="font-semibold text-[var(--retina-secondary)]"
          >
            {t("resetPassword.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}

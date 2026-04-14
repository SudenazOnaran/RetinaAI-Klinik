"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, UserPlus } from "lucide-react";
import { DoctorRole } from "@/lib/roles";
import { useTranslation } from "@/components/providers/i18n-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

function generateTemporaryPassword() {
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `Tmp-${randomPart}A1`;
}

type ManagedDoctor = {
  id: string;
  name: string;
  email: string;
  role: DoctorRole;
  isActive: boolean;
  createdAt: string;
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<DoctorRole>("ASSISTANT");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tempPassword, setTempPassword] = useState(generateTemporaryPassword());
  const [isLoading, setIsLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [canRegister, setCanRegister] = useState(false);
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);
  const [users, setUsers] = useState<ManagedDoctor[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/doctor/register");
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const res = await fetch("/api/doctor/session");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.doctor?.role === "MANAGER") {
          setCanRegister(true);
          setCurrentDoctorId(data.doctor.id || null);
          void loadUsers();
        }
      } catch {
        // Oturum kontrolu basarisizsa kayit acilmaz.
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRegister) {
      setError(t("register.errors.managerOnly"));
      return;
    }

    setError("");
    setSuccess("");
    setIsLoading(true);
    if (!name || !email) {
      setError(t("register.errors.requiredFields"));
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/doctor/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role,
          temporaryPassword: tempPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(
          t("register.success.created"),
        );
        setName("");
        setEmail("");
        setRole("ASSISTANT");
        setTempPassword(generateTemporaryPassword());
        await loadUsers();
      } else {
        setError(data.error || t("register.errors.createFailed"));
      }
    } catch {
      setError(t("register.errors.server"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivate = async (doctorId: string) => {
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/doctor/register", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, isActive: false }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(t("register.success.deactivated"));
        await loadUsers();
      } else {
        setError(data.error || t("register.errors.deactivateFailed"));
      }
    } catch {
      setError(t("register.errors.server"));
    }
  };

  return (
    <div className="clinic-app-bg min-h-screen px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="clinic-panel grid w-full overflow-hidden rounded-2xl md:grid-cols-2">
          <form onSubmit={handleRegister} className="p-8 md:p-10">
            <div className="mb-4 flex justify-end">
              <LanguageSwitcher />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              {t("register.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("register.subtitle")}
            </p>

            {!authLoading && !canRegister && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t("register.managerWarning")}
              </div>
            )}

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("register.fields.name")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canRegister || authLoading}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("register.fields.email")}
                </label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canRegister || authLoading}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("register.fields.temporaryPassword")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 font-mono outline-none focus:border-[var(--retina-primary)]"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    disabled={!canRegister || authLoading}
                    minLength={10}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setTempPassword(generateTemporaryPassword())}
                    className="rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
                    disabled={!canRegister || authLoading}
                  >
                    {t("register.refresh")}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t("register.temporaryPasswordHint")}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {t("register.fields.role")}
                </label>
                <select
                  className="w-full rounded-lg border border-[var(--retina-border)] px-3 py-2.5 outline-none focus:border-[var(--retina-primary)]"
                  value={role}
                  onChange={(e) => setRole(e.target.value as DoctorRole)}
                  disabled={!canRegister || authLoading}
                >
                  <option value="ASSISTANT">{t("register.roles.assistant")}</option>
                  <option value="DOCTOR">{t("register.roles.doctor")}</option>
                  <option value="MANAGER">{t("register.roles.manager")}</option>
                  <option value="AUDITOR">{t("register.roles.auditor")}</option>
                </select>
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
                disabled={isLoading || authLoading || !canRegister}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--retina-primary)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--retina-primary-deep)] disabled:opacity-70"
              >
                <UserPlus className="h-4 w-4" />
                {authLoading
                  ? t("register.states.checkingAuth")
                  : isLoading
                    ? t("register.states.creating")
                    : canRegister
                      ? t("register.states.createUser")
                      : t("register.states.managerOnly")}
              </button>
            </div>

            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">
                  {t("register.userList.title")}
                </h3>
                <button
                  type="button"
                  onClick={() => void loadUsers()}
                  className="text-xs font-semibold text-[var(--retina-secondary)]"
                  disabled={usersLoading || !canRegister}
                >
                  {t("register.refresh")}
                </button>
              </div>

              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {u.name}
                      </p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                      <p className="text-xs text-slate-500">
                        {u.role} • {u.isActive ? t("register.active") : t("register.passive")}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700 disabled:opacity-40"
                      onClick={() => void handleDeactivate(u.id)}
                      disabled={
                        !u.isActive || u.id === currentDoctorId || !canRegister
                      }
                    >
                      {t("register.deactivate")}
                    </button>
                  </div>
                ))}
                {!users.length && (
                  <p className="text-xs text-slate-500">
                    {t("register.userList.empty")}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 text-sm text-slate-600">
              <Link
                href="/dashboard"
                className="font-semibold text-[var(--retina-secondary)] hover:text-[var(--retina-secondary-soft)]"
              >
                {t("register.backDashboard")}
              </Link>
            </div>
          </form>

          <div className="hidden border-l border-[var(--retina-border)] bg-gradient-to-br from-[#0088BB] to-[#00A8CC] p-10 text-white md:flex md:flex-col md:justify-between">
            <div>
              <p className="clinic-wood-strip inline-flex items-center gap-2 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                <Eye className="h-3.5 w-3.5" /> {t("register.side.brand")}
              </p>
              <h1 className="mt-4 text-3xl font-bold leading-tight">
                {t("register.side.title")}
              </h1>
              <p className="mt-3 text-sm text-blue-100">
                {t("register.side.description")}
              </p>
            </div>

            <div className="rounded-xl border border-white/25 bg-white/10 p-4 text-sm text-blue-50 backdrop-blur-sm">
              {t("register.side.note")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

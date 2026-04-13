"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  Mail,
  Phone,
  MessageSquareText,
} from "lucide-react";

type AdminTab = "doctors" | "landing";

type DoctorRequest = {
  id: string;
  name: string;
  surname: string;
  email: string;
  specialty: string;
  hospital: string;
  role: string;
  approvalStatus: string;
  isActive: boolean;
  createdAt: string;
};

type FilterStatus = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

type LandingContactRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  createdAt: string;
};

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("doctors");
  const [doctors, setDoctors] = useState<DoctorRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [landingRows, setLandingRows] = useState<LandingContactRow[]>([]);
  const [landingLoading, setLandingLoading] = useState(false);

  const loadDoctors = useCallback(async (status: FilterStatus) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/requests?status=${status}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.doctors)) {
        setDoctors(data.doctors);
      }
    } catch {
      setMessage({ type: "error", text: "Veriler yüklenirken hata oluştu." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors(filter);
  }, [filter, loadDoctors]);

  const loadLandingContacts = useCallback(async () => {
    setLandingLoading(true);
    try {
      const res = await fetch("/api/admin/landing-contacts");
      const data = await res.json();
      if (res.ok && Array.isArray(data.requests)) {
        setLandingRows(data.requests);
      } else {
        setMessage({ type: "error", text: data.error || "Tanıtım talepleri yüklenemedi." });
      }
    } catch {
      setMessage({ type: "error", text: "Tanıtım talepleri yüklenirken hata oluştu." });
    } finally {
      setLandingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "landing") {
      void loadLandingContacts();
    }
  }, [tab, loadLandingContacts]);

  const handleAction = async (doctorId: string, action: "APPROVE" | "REJECT") => {
    setActionLoading(doctorId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId, action }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({
          type: "success",
          text: data.message,
        });
        await loadDoctors(filter);
      } else {
        setMessage({ type: "error", text: data.error || "İşlem başarısız." });
      }
    } catch {
      setMessage({ type: "error", text: "Sunucuya bağlanırken hata oluştu." });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = doctors.filter((d) => d.approvalStatus === "PENDING").length;

  const statusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <Clock className="h-3 w-3" /> Beklemede
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle className="h-3 w-3" /> Onaylandı
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800">
            <XCircle className="h-3 w-3" /> Reddedildi
          </span>
        );
      default:
        return null;
    }
  };

  const filterButtons: Array<{ label: string; value: FilterStatus; icon: React.ReactNode }> = [
    { label: "Bekleyenler", value: "PENDING", icon: <Clock className="h-4 w-4" /> },
    { label: "Onaylananlar", value: "APPROVED", icon: <UserCheck className="h-4 w-4" /> },
    { label: "Reddedilenler", value: "REJECTED", icon: <UserX className="h-4 w-4" /> },
    { label: "Tümü", value: "ALL", icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--retina-border)] bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--retina-primary)]">
              Admin Yönetim Paneli
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              {tab === "doctors" ? "Doktor Başvuru Yönetimi" : "Bize Ulaşın Talepleri"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {tab === "doctors"
                ? "Kayıt olan doktorların başvurularını inceleyin, onaylayın veya reddedin. Tanıtım sitesindeki iletişim formu için üstteki «Bize Ulaşın talepleri» sekmesine geçin."
                : "Tanıtım sitesindeki «Bize Ulaşın» formundan gelen talepler burada listelenir."}
            </p>
          </div>
          {tab === "doctors" && filter === "PENDING" && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">
                {pendingCount > 0
                  ? `${pendingCount} bekleyen başvuru`
                  : "Bekleyen başvuru yok"}
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setTab("doctors");
          }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "doctors"
              ? "bg-[var(--retina-primary)] text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Users className="h-4 w-4" />
          Doktor başvuruları
        </button>
        <button
          type="button"
          onClick={() => {
            setMessage(null);
            setTab("landing");
          }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "landing"
              ? "bg-[var(--retina-primary)] text-white"
              : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <MessageSquareText className="h-4 w-4" />
          Bize Ulaşın talepleri
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {tab === "landing" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => loadLandingContacts()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-4 w-4 ${landingLoading ? "animate-spin" : ""}`} />
              Yenile
            </button>
          </div>
          <div className="rounded-2xl border border-[var(--retina-border)] bg-white shadow-sm">
            {landingLoading ? (
              <div className="flex items-center justify-center py-16 text-sm text-slate-500">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Yükleniyor...
              </div>
            ) : landingRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <MessageSquareText className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold">Henüz talep bulunmuyor.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {landingRows.map((row) => (
                  <div key={row.id} className="space-y-2 px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{row.fullName}</p>
                      <span className="text-xs text-slate-400">
                        {new Date(row.createdAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      {row.email && (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-[var(--retina-primary)]" />
                          <a href={`mailto:${row.email}`} className="underline hover:text-slate-900">
                            {row.email}
                          </a>
                        </span>
                      )}
                      {row.phone && (
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-[var(--retina-primary)]" />
                          <a href={`tel:${row.phone.replace(/\s/g, "")}`} className="underline hover:text-slate-900">
                            {row.phone}
                          </a>
                        </span>
                      )}
                    </div>
                    {row.message && (
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">
                        {row.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "doctors" && (
      <>
      <div className="flex flex-wrap gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.value}
            onClick={() => setFilter(btn.value)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              filter === btn.value
                ? "bg-[var(--retina-primary)] text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {btn.icon}
            {btn.label}
          </button>
        ))}

        <button
          onClick={() => loadDoctors(filter)}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Yenile
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--retina-border)] bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Yükleniyor...
          </div>
        ) : doctors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Users className="mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold">
              {filter === "PENDING"
                ? "Bekleyen başvuru bulunmuyor."
                : "Bu filtreye uygun kayıt bulunamadı."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {doctors.map((doctor) => (
              <div
                key={doctor.id}
                className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#edf5ff] text-sm font-bold text-[var(--retina-primary)]">
                      {doctor.name[0]}
                      {doctor.surname[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Dr. {doctor.name} {doctor.surname}
                      </p>
                      <p className="text-xs text-slate-500">{doctor.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pl-[52px]">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {doctor.specialty || "Belirtilmemiş"}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {doctor.hospital || "Belirtilmemiş"}
                    </span>
                    {statusBadge(doctor.approvalStatus)}
                    <span className="text-xs text-slate-400">
                      {new Date(doctor.createdAt).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {doctor.approvalStatus === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(doctor.id, "APPROVE")}
                      disabled={actionLoading === doctor.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Onayla
                    </button>
                    <button
                      onClick={() => handleAction(doctor.id, "REJECT")}
                      disabled={actionLoading === doctor.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      <XCircle className="h-4 w-4" />
                      Reddet
                    </button>
                  </div>
                )}

                {doctor.approvalStatus === "REJECTED" && (
                  <button
                    onClick={() => handleAction(doctor.id, "APPROVE")}
                    disabled={actionLoading === doctor.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Tekrar Onayla
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}

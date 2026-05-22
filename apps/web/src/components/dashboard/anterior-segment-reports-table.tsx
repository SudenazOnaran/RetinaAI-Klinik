"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { format } from "date-fns";
import { tr, enGB } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/components/providers/i18n-provider";
import { humanizeAnteriorSegmentDoctorFeedback } from "@/lib/anterior-segment-feedback-display";
import {
  deleteAnteriorSegmentReportAction,
  type AnteriorSegmentReportRow,
} from "@/app/actions/save-anterior-segment-report";
import { ChevronDown, History, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SNIPPET_MAX = 120;

function clip(text: string | null | undefined, max = SNIPPET_MAX) {
  const s = String(text ?? "").trim();
  if (!s) return "—";
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

type AnteriorSegmentReportsTableProps = {
  initialReports: AnteriorSegmentReportRow[];
  refreshToken?: number;
  onReportsChange?: (reports: AnteriorSegmentReportRow[]) => void;
};

export function AnteriorSegmentReportsTable({
  initialReports,
  onReportsChange,
}: AnteriorSegmentReportsTableProps) {
  const { t, locale } = useTranslation();
  const { toast } = useToast();
  const [reports, setReports] = useState(initialReports);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dateLocale = locale === "tr" ? tr : enGB;

  const syncReports = useCallback(
    (next: AnteriorSegmentReportRow[]) => {
      setReports(next);
      onReportsChange?.(next);
    },
    [onReportsChange],
  );

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await deleteAnteriorSegmentReportAction(id);
      if (res.ok) {
        const next = reports.filter((r) => r.id !== id);
        syncReports(next);
        toast({ title: t("anteriorSegmentHistory.deletedTitle") });
      } else {
        toast({
          variant: "destructive",
          title: t("errorPage.title"),
          description: res.error,
        });
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="border border-[#d8e0df] bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
          <History className="h-5 w-5 text-[var(--retina-primary)]" />
          {t("anteriorSegmentHistory.title")}
        </CardTitle>
        <CardDescription>{t("anteriorSegmentHistory.description")}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {reports.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-500">
            {t("anteriorSegmentHistory.empty")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-[88px]">{t("anteriorSegmentHistory.colImage")}</TableHead>
                <TableHead>{t("anteriorSegmentHistory.colDate")}</TableHead>
                <TableHead>{t("anteriorSegmentHistory.colAiSummary")}</TableHead>
                <TableHead>{t("anteriorSegmentHistory.colDoctorFeedback")}</TableHead>
                <TableHead>{t("anteriorSegmentHistory.colNotes")}</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((row) => {
                const feedbackLabel = humanizeAnteriorSegmentDoctorFeedback(
                  row.anteriorSegmentDrFeedback,
                  t,
                );
                const isOpen = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell>
                        <button
                          type="button"
                          className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200 bg-slate-950"
                          onClick={() => setPreviewUrl(row.imageUrl)}
                        >
                          <Image
                            src={row.imageUrl}
                            alt=""
                            fill
                            unoptimized
                            sizes="56px"
                            className="object-cover"
                          />
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-700">
                        {format(new Date(row.createdAt), "dd MMM yyyy HH:mm", {
                          locale: dateLocale,
                        })}
                        {row.urgentReferralNeeded ? (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            {t("anteriorSegmentHistory.urgentBadge")}
                          </Badge>
                        ) : null}
                        {row.patient ? (
                          <p className="mt-1 text-[10px] text-slate-500">
                            {row.patient.fullName}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[220px] text-xs text-slate-800">
                        {clip(row.aiSummary)}
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs text-slate-800">
                        {clip(feedbackLabel, 100)}
                      </TableCell>
                      <TableCell className="max-w-[160px] text-xs text-slate-600">
                        {clip(row.analysisNotes, 80)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Collapsible
                            open={isOpen}
                            onOpenChange={(o) => setExpandedId(o ? row.id : null)}
                          >
                            <CollapsibleTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                              >
                                {t("anteriorSegmentHistory.viewDetail")}
                                <ChevronDown
                                  className={`ml-1 h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent />
                          </Collapsible>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-rose-700 hover:text-rose-800"
                            disabled={deletingId === row.id}
                            onClick={() => void handleDelete(row.id)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            {t("anteriorSegmentHistory.delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isOpen ? (
                      <TableRow key={`${row.id}-detail`} className="bg-slate-50/50">
                        <TableCell colSpan={6} className="px-6 py-4">
                          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_200px]">
                            <div className="space-y-3 text-xs text-slate-800">
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-slate-500">
                                  {t("anteriorSegmentHistory.fullAiOutput")}
                                </p>
                                <pre className="mt-1 max-h-[280px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-sans text-xs leading-relaxed">
                                  {row.aiTextSummary || row.aiSummary || "—"}
                                </pre>
                              </div>
                              <div>
                                <p className="font-semibold uppercase tracking-wide text-slate-500">
                                  {t("anteriorSegmentHistory.colDoctorFeedback")}
                                </p>
                                <p className="mt-1">{feedbackLabel}</p>
                              </div>
                              {row.analysisNotes ? (
                                <div>
                                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                                    {t("anteriorSegmentHistory.colNotes")}
                                  </p>
                                  <p className="mt-1 whitespace-pre-wrap">{row.analysisNotes}</p>
                                </div>
                              ) : null}
                            </div>
                            <div className="relative mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                              <Image
                                src={row.imageUrl}
                                alt=""
                                fill
                                unoptimized
                                sizes="200px"
                                className="object-contain"
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute -right-2 -top-2 z-10 h-9 w-9 rounded-full"
              onClick={() => setPreviewUrl(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <div className="relative h-[min(80vh,640px)] w-[min(90vw,720px)] overflow-hidden rounded-2xl bg-slate-950">
              <Image
                src={previewUrl}
                alt=""
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

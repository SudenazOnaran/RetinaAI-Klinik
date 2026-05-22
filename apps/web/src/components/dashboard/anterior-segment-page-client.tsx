"use client";

import { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnteriorSegmentAnalysisCard } from "@/components/dashboard/anterior-segment-analysis-card";
import { AnteriorSegmentReportsTable } from "@/components/dashboard/anterior-segment-reports-table";
import {
  listAnteriorSegmentReportsAction,
  saveAnteriorSegmentReportAction,
  type AnteriorSegmentReportRow,
} from "@/app/actions/save-anterior-segment-report";
import { useTranslation } from "@/components/providers/i18n-provider";

type AnteriorSegmentPageClientProps = {
  initialReports: AnteriorSegmentReportRow[];
};

export function AnteriorSegmentPageClient({
  initialReports,
}: AnteriorSegmentPageClientProps) {
  const { t } = useTranslation();
  const [reports, setReports] = useState(initialReports);
  const [activeTab, setActiveTab] = useState("analyze");
  const [listRefresh, setListRefresh] = useState(0);

  const reloadReports = useCallback(async () => {
    const res = await listAnteriorSegmentReportsAction();
    if (res.ok) {
      setReports(res.reports);
      setListRefresh((n) => n + 1);
    }
  }, []);

  const handleSaved = useCallback(async () => {
    await reloadReports();
    setActiveTab("history");
  }, [reloadReports]);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl bg-slate-100 p-1">
        <TabsTrigger value="analyze" className="rounded-lg">
          {t("anteriorSegmentPage.tabAnalyze")}
        </TabsTrigger>
        <TabsTrigger value="history" className="rounded-lg">
          {t("anteriorSegmentPage.tabHistory")}
          {reports.length > 0 ? (
            <span className="ml-2 rounded-full bg-[var(--retina-primary)] px-2 py-0.5 text-[10px] font-semibold text-white">
              {reports.length}
            </span>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="analyze" className="mt-0">
        <AnteriorSegmentAnalysisCard
          variant="full"
          suppressHeader
          onSaveReport={async (payload) => {
            const res = await saveAnteriorSegmentReportAction(payload);
            if (res.ok) {
              await handleSaved();
              return { ok: true as const };
            }
            return { ok: false as const, error: res.error };
          }}
        />
      </TabsContent>

      <TabsContent value="history" className="mt-0">
        <AnteriorSegmentReportsTable
          initialReports={reports}
          refreshToken={listRefresh}
          onReportsChange={setReports}
        />
      </TabsContent>
    </Tabs>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/components/providers/i18n-provider";

export default function PatientTable({ patients }: { patients: any[] }) {
  const { t, locale } = useTranslation();
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-3 text-left">{t("patientTable.colName")}</th>
            <th className="p-3 text-left">{t("patientTable.colTc")}</th>
            <th className="p-3 text-left">{t("patientTable.colCreated")}</th>
            <th className="p-3 text-left">{t("patientTable.colAge")}</th>
            <th className="p-3 text-left">{t("patientTable.colRisk")}</th>
            <th className="p-3 text-right">{t("patientTable.colActions")}</th>
          </tr>
        </thead>

        <tbody>
          {patients.map((p) => {
            const risk = (p.risk ?? "").toString().trim();

            return (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.fullName}</td>
                <td className="p-3">{p.tcNo}</td>
                <td className="p-3">
                  {new Date(p.createdAt).toLocaleDateString(
                    locale === "en" ? "en-US" : "tr-TR",
                  )}
                </td>

                <td className="p-3">{p.age}</td>
                <td className="p-3">
                  <Badge
                    className={
                      risk === "Yüksek"
                        ? "bg-red-500 text-white"
                        : risk === "Orta"
                          ? "bg-yellow-400 text-black"
                          : risk === "Düşük"
                            ? "bg-green-500 text-white"
                            : "border"
                    }
                  >
                    {risk || t("patientTable.noAnalysis")}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <Link href={`/dashboard/hastalar/${p.id}`}>
                    <Button variant="outline" size="sm">
                      {t("patientTable.detail")}
                    </Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Geçmiş Kayıtlar
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Klinik geçmiş kayıtları ve analiz arşivi bu bölümde listelenir.
        </p>
      </div>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <CardTitle>Yakında Burada</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="text-sm text-slate-600">
            Tüm hastaların geçmiş muayene kayıtları ve analiz sonuçları bu
            sayfada görüntülenecektir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

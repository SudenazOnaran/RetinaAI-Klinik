import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="relative p-6 space-y-10 min-h-screen bg-slate-50/50">
      {/* 🌌 Sabit Arka Plan Işığı (Performans için statik) */}
      <div className="fixed inset-0 -z-20">
        <div className="absolute top-[-5%] right-[-5%] h-64 w-64 rounded-full bg-blue-100/40 blur-[80px]" />
      </div>

      {/* Header Skeleton */}
      <div className="relative space-y-4">
        <Skeleton className="h-10 w-64 bg-slate-200/60 rounded-xl" />
        <Skeleton className="h-4 w-96 bg-slate-200/40 rounded-lg" />
      </div>

      {/* Stats Skeleton (3'lü Kartlar) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-white border border-slate-100 p-6 flex items-center justify-between shadow-sm"
          >
            <div className="space-y-3">
              <Skeleton className="h-3 w-20 bg-slate-100" />
              <Skeleton className="h-8 w-12 bg-slate-200" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Table Area Skeleton */}
      <Card className="border-none bg-white/70 backdrop-blur-md shadow-xl p-6 rounded-3xl">
        {/* Search Bar Skeleton */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <Skeleton className="h-12 flex-1 bg-slate-100 rounded-xl" />
          <Skeleton className="h-12 w-32 bg-slate-100 rounded-xl" />
        </div>

        {/* Liste Satırları */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-white/50"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl bg-slate-200" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40 bg-slate-200" />
                  <Skeleton className="h-3 w-24 bg-slate-100" />
                </div>
              </div>
              <div className="flex gap-8 items-center">
                <Skeleton className="h-6 w-20 rounded-full bg-slate-100 hidden md:block" />
                <Skeleton className="h-10 w-24 rounded-xl bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

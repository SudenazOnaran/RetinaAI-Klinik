import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';


export default function PatientTable({ patients }: { patients: any[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            <th className="p-3 text-left">Hasta Adı</th>
            <th className="p-3 text-left">TC</th>
            <th className="p-3 text-left">Kayıt Tarihi</th>
            <th className="p-3 text-left">Yaş</th>
            <th className="p-3 text-left">Risk Seviyesi</th>
            <th className="p-3 text-right">Eylemler</th>
          </tr>
        </thead>

        <tbody>
          {patients.map((p) => {
            const risk = (p.risk ?? '').toString().trim();
            const hasRisk = risk.length > 0 && risk !== 'Yok';


            return (
              <tr key={p.id} className="border-t">
                <td className="p-3">{p.fullName}</td>
                <td className="p-3">{p.tcNo}</td>
                <td className="p-3">
                    {new Date(p.createdAt).toLocaleDateString('tr-TR')}
                </td>

                <td className="p-3">{p.age}</td>
                <td className="p-3">
                  <Badge
                    className={
                      risk === 'Yüksek'
                        ? 'bg-red-500 text-white'
                        : risk === 'Orta'
                        ? 'bg-yellow-400 text-black'
                        : risk === 'Düşük'
                        ? 'bg-green-500 text-white'
                        : 'border'
                    }
                  >
                    {risk || 'Analiz yapılmadı'}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <Link href={`/dashboard/hastalar/${p.id}`}>
                    <Button variant="outline" size="sm">
                      Detay
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

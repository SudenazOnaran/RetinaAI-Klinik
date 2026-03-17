'use client';

import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import type { AnalysisHistoryItem } from '@/app/dashboard/hastalar/[id]/page';

interface DiseaseProgressionChartProps {
  data: AnalysisHistoryItem[];
}

const drLevelMapping: { [key: string]: number } = {
  Yok: 0,
  Hafif: 1,
  Orta: 2,
  Ciddi: 3,
  Proliferatif: 4,
};

const drLevelLabels: { [key: number]: string } = {
  0: 'Yok',
  1: 'Hafif',
  2: 'Orta',
  3: 'Ciddi',
  4: 'Proliferatif',
};

export function DiseaseProgressionChart({ data }: DiseaseProgressionChartProps) {
  const chartData = data.map(item => ({
    date: new Date(item.date),
    level: drLevelMapping[item.label],
    label: item.label,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card className="p-3 shadow-lg">
          <p className="font-semibold">{format(new Date(label), 'dd MMMM yyyy', { locale: tr })}</p>
          <p className="text-primary">{`Seviye: ${payload[0].payload.label}`}</p>
        </Card>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(date) => format(date, 'dd/MM/yy')}
          domain={['dataMin', 'dataMax']}
          type="number"
          scale="time"
        />
        <YAxis
          domain={[0, 4]}
          ticks={[0, 1, 2, 3, 4]}
          tickFormatter={(level) => drLevelLabels[level]}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          type="monotone"
          dataKey="level"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          activeDot={{ r: 8 }}
          name="DR Seviyesi"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

    
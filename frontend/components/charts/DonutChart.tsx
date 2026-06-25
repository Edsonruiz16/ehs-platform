'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface Slice {
  name: string;
  value: number;
  color: string;
}

export default function DonutChart({ data, centerLabel }: { data: Slice[]; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={24} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 grid place-items-center pointer-events-none -mt-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-ink">{total}</div>
          <div className="text-[11px] text-muted">{centerLabel ?? 'Total'}</div>
        </div>
      </div>
    </div>
  );
}

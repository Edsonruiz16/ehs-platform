'use client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { LEVEL_COLORS } from '@/lib/format';

const SERIES = [
  { key: 'ACTO_INSEGURO', label: 'Actos inseguros' },
  { key: 'CONDICION_INSEGURA', label: 'Condiciones inseguras' },
  { key: 'CASI_INCIDENTE', label: 'Casi incidentes' },
  { key: 'PRIMEROS_AUXILIOS', label: 'Primeros auxilios' },
  { key: 'TRATAMIENTO_MEDICO', label: 'Tratamiento médico' },
  { key: 'ACTIVIDAD_RESTRINGIDA', label: 'Act. restringida' },
  { key: 'LOST_TIME', label: 'Lost time' },
  { key: 'FATALIDAD', label: 'Fatalidades' },
];

export default function MonthlyTrend({ data }: { data: Record<string, number | string>[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -10, right: 16, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {SERIES.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={LEVEL_COLORS[i]}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

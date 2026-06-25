'use client';
import { LEVEL_COLORS } from '@/lib/format';

interface Row {
  level: string;
  label: string;
  count: number;
}

/**
 * Pirámide de Heinrich visual: cada nivel es una banda trapezoidal cuyo ancho
 * crece hacia la base. La fatalidad queda en la cúspide.
 */
export default function PyramidChart({ data }: { data: Row[] }) {
  // De cúspide (fatalidad) a base (actos inseguros).
  const ordered = [...data].reverse();
  const n = ordered.length;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex flex-col items-center gap-1">
      {ordered.map((row, i) => {
        const widthPct = 30 + ((n - i) / n) * 70; // de angosto a ancho
        const color = LEVEL_COLORS[n - 1 - i] ?? '#0f3d5e';
        return (
          <div
            key={row.level}
            className="relative flex items-center justify-between px-4 text-white text-xs font-medium rounded-sm"
            style={{
              width: `${widthPct}%`,
              background: color,
              height: 38,
              clipPath: i === 0 ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined,
            }}
            title={`${row.label}: ${row.count}`}
          >
            <span className="truncate drop-shadow">{i === 0 ? '' : row.label}</span>
            <span className="font-bold">{row.count}</span>
          </div>
        );
      })}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] w-full">
        {data.map((d, i) => (
          <div key={d.level} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: LEVEL_COLORS[i] }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="ml-auto font-semibold">{d.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-xs text-muted">
        Total: <b>{data.reduce((s, d) => s + d.count, 0)}</b> · Ratio base/cúspide indica oportunidad preventiva
      </div>
    </div>
  );
}

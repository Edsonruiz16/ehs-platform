'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { STATUS_COLORS, RISK_COLORS } from '@/lib/format';
import KpiCard from '@/components/KpiCard';
import GlobalFilters, { Filters } from '@/components/GlobalFilters';
import PyramidChart from '@/components/charts/PyramidChart';
import DonutChart from '@/components/charts/DonutChart';
import BarChartH from '@/components/charts/BarChartH';
import MonthlyTrend from '@/components/charts/MonthlyTrend';

interface Overview {
  pyramid: { level: string; label: string; count: number }[];
  bySource: { source: string; count: number }[];
  monthly: Record<string, number | string>[];
  byArea: { area: string; count: number }[];
  byMachine: { machine: string; count: number }[];
  topConditions: { area: string; count: number }[];
  topActs: { area: string; count: number }[];
  topResponsibles: { responsible: string; open: number }[];
  actionsSummary: {
    total: number;
    byStatus: Record<string, number>;
    byRisk: Record<string, number>;
    byDue: Record<string, number>;
  };
}

export default function DashboardPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ data: Overview }>('/dashboard/overview', { query: filters as never });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const a = data?.actionsSummary;
  const pct = (n = 0, t = 1) => `${Math.round((n / Math.max(t, 1)) * 100)}%`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Dashboard EHS</h1>
          <p className="text-sm text-muted">Centro de control · Seguridad industrial</p>
        </div>
      </div>

      <GlobalFilters value={filters} onChange={setFilters} />

      {loading || !data ? (
        <div className="text-muted py-12 text-center">Cargando indicadores…</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total registros pirámide" value={data.pyramid.reduce((s, p) => s + p.count, 0)} />
            <KpiCard label="Acciones abiertas" value={a?.byStatus.ABIERTA ?? 0} color={STATUS_COLORS.ABIERTA} hint={pct(a?.byStatus.ABIERTA, a?.total)} />
            <KpiCard label="Acciones en proceso" value={a?.byStatus.EN_PROCESO ?? 0} color={STATUS_COLORS.EN_PROCESO} hint={pct(a?.byStatus.EN_PROCESO, a?.total)} />
            <KpiCard label="Acciones vencidas" value={a?.byDue.VENCIDA ?? 0} color={RISK_COLORS.ALTO} hint="Requieren atención" />
          </div>

          {/* Pirámide + acciones */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card lg:col-span-2">
              <div className="card-title">Pirámide de Heinrich</div>
              <PyramidChart data={data.pyramid} />
            </div>
            <div className="space-y-4">
              <div className="card">
                <div className="card-title">Acciones por estatus</div>
                <DonutChart
                  centerLabel="Acciones"
                  data={[
                    { name: 'Abiertas', value: a?.byStatus.ABIERTA ?? 0, color: STATUS_COLORS.ABIERTA },
                    { name: 'En proceso', value: a?.byStatus.EN_PROCESO ?? 0, color: STATUS_COLORS.EN_PROCESO },
                    { name: 'Cerradas', value: a?.byStatus.CERRADA ?? 0, color: STATUS_COLORS.CERRADA },
                  ]}
                />
              </div>
              <div className="card">
                <div className="card-title">Acciones por riesgo</div>
                <div className="flex justify-around text-center">
                  {(['BAJO', 'MEDIO', 'ALTO'] as const).map((r) => (
                    <div key={r}>
                      <div className="text-2xl font-bold" style={{ color: RISK_COLORS[r] }}>
                        {a?.byRisk[r] ?? 0}
                      </div>
                      <div className="text-[11px] text-muted">{r}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tendencia mensual */}
          <div className="card">
            <div className="card-title">Comportamiento mensual de la pirámide</div>
            <MonthlyTrend data={data.monthly} />
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card">
              <div className="card-title">Top áreas · Actos inseguros</div>
              <BarChartH data={data.topActs.map((r) => ({ name: r.area, value: r.count }))} color={RISK_COLORS.MEDIO} />
            </div>
            <div className="card">
              <div className="card-title">Top áreas · Condiciones inseguras</div>
              <BarChartH data={data.topConditions.map((r) => ({ name: r.area, value: r.count }))} color={RISK_COLORS.ALTO} />
            </div>
            <div className="card">
              <div className="card-title">Top responsables · Acciones abiertas</div>
              <BarChartH data={data.topResponsibles.map((r) => ({ name: r.responsible, value: r.open }))} color="#0f3d5e" />
            </div>
          </div>

          {/* Área / máquina / origen */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card">
              <div className="card-title">Registros por área</div>
              <BarChartH data={data.byArea.map((r) => ({ name: r.area, value: r.count }))} color="#1d6fa5" />
            </div>
            <div className="card">
              <div className="card-title">Registros por máquina / equipo</div>
              <BarChartH data={data.byMachine.map((r) => ({ name: r.machine, value: r.count }))} color="#1d6fa5" />
            </div>
            <div className="card">
              <div className="card-title">Distribución por origen</div>
              <DonutChart
                centerLabel="Registros"
                data={data.bySource.map((s, i) => ({
                  name: s.source,
                  value: s.count,
                  color: ['#0f3d5e', '#1d6fa5', '#dc2626', '#16a34a', '#f59e0b'][i % 5],
                }))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

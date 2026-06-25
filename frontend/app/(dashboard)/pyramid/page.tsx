'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import GlobalFilters, { Filters } from '@/components/GlobalFilters';
import PyramidChart from '@/components/charts/PyramidChart';
import MonthlyTrend from '@/components/charts/MonthlyTrend';
import DonutChart from '@/components/charts/DonutChart';

export default function PyramidPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    const res = await api<{ data: any }>('/dashboard/pyramid', { query: filters as never });
    setData(res.data);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pirámide de Heinrich</h1>
      <GlobalFilters value={filters} onChange={setFilters} />
      {!data ? (
        <div className="text-muted py-12 text-center">Cargando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card lg:col-span-2">
              <div className="card-title">Vista consolidada</div>
              <PyramidChart data={data.pyramid} />
            </div>
            <div className="card">
              <div className="card-title">Distribución por origen</div>
              <DonutChart
                centerLabel="Registros"
                data={data.bySource.map((s: any, i: number) => ({
                  name: s.source,
                  value: s.count,
                  color: ['#0f3d5e', '#1d6fa5', '#dc2626', '#16a34a', '#f59e0b'][i % 5],
                }))}
              />
            </div>
          </div>
          <div className="card">
            <div className="card-title">Tendencia mensual por nivel</div>
            <MonthlyTrend data={data.monthly} />
          </div>
        </>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { RiskBadge, StatusBadge } from '@/components/RiskBadge';

interface Action {
  _id: string;
  folio: string;
  source: string;
  area?: string;
  description: string;
  requiredAction: string;
  risk: string;
  responsible: string;
  dueDate?: string;
  status: string;
  dueState: string;
}

const DUE_COLORS: Record<string, string> = {
  AL_DIA: '#16a34a',
  POR_VENCER: '#f59e0b',
  VENCIDA: '#dc2626',
  CERRADA: '#64748b',
};

export default function ActionsPage() {
  const [items, setItems] = useState<Action[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState<{ status?: string; due?: string; source?: string }>({});

  const load = useCallback(async () => {
    const [list, sum] = await Promise.all([
      api<{ items: Action[] }>('/actions', { query: { ...filter, limit: 200 } as never }),
      api<any>('/actions/summary'),
    ]);
    setItems(list.items);
    setSummary(sum);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: string, status: string) {
    await api(`/actions/${id}/status`, { method: 'PATCH', body: { status } });
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Motor de Acciones</h1>
        <p className="text-sm text-muted">Repositorio único · STOP, Comisión, Incidentes e IPERC</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card"><div className="text-xs text-muted">Total</div><div className="text-2xl font-bold">{summary.total}</div></div>
          <div className="card"><div className="text-xs text-muted">Abiertas</div><div className="text-2xl font-bold text-red-600">{summary.byStatus.ABIERTA}</div></div>
          <div className="card"><div className="text-xs text-muted">En proceso</div><div className="text-2xl font-bold text-amber-500">{summary.byStatus.EN_PROCESO}</div></div>
          <div className="card"><div className="text-xs text-muted">Vencidas</div><div className="text-2xl font-bold text-red-700">{summary.byDue.VENCIDA}</div></div>
        </div>
      )}

      <div className="card flex flex-wrap gap-3 items-end">
        <Filter label="Estatus" value={filter.status} onChange={(v) => setFilter({ ...filter, status: v })} options={['ABIERTA', 'EN_PROCESO', 'CERRADA']} />
        <Filter label="Vencimiento" value={filter.due} onChange={(v) => setFilter({ ...filter, due: v })} options={['AL_DIA', 'POR_VENCER', 'VENCIDA']} />
        <Filter label="Origen" value={filter.source} onChange={(v) => setFilter({ ...filter, source: v })} options={['STOP', 'COMMISSION', 'INCIDENT', 'IPERC', 'EXCEL']} />
        <button className="btn-ghost" onClick={() => setFilter({})}>Limpiar</button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>{['Folio', 'Origen', 'Área', 'Acción', 'Riesgo', 'Responsable', 'Compromiso', 'Venc.', 'Estatus', ''].map((h) => <th key={h} className="px-3 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((a) => (
              <tr key={a._id} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{a.folio}</td>
                <td className="px-3 py-2 text-xs">{a.source}</td>
                <td className="px-3 py-2">{a.area ?? '—'}</td>
                <td className="px-3 py-2 max-w-[260px] truncate" title={a.requiredAction}>{a.requiredAction}</td>
                <td className="px-3 py-2"><RiskBadge risk={a.risk} /></td>
                <td className="px-3 py-2">{a.responsible}</td>
                <td className="px-3 py-2">{fmtDate(a.dueDate)}</td>
                <td className="px-3 py-2">
                  <span className="badge" style={{ background: `${DUE_COLORS[a.dueState]}1a`, color: DUE_COLORS[a.dueState] }}>
                    {a.dueState.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-2"><StatusBadge status={a.status} /></td>
                <td className="px-3 py-2">
                  <select
                    className="text-xs border border-slate-200 rounded px-1 py-0.5"
                    value={a.status}
                    onChange={(e) => changeStatus(a._id, e.target.value)}
                  >
                    {['ABIERTA', 'EN_PROCESO', 'CERRADA'].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted">Sin acciones</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1 min-w-[140px]">
      <span className="text-xs text-muted">{label}</span>
      <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
      </select>
    </label>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export interface Filters {
  year?: string;
  month?: string;
  area?: string;
  source?: string;
}

const MONTHS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function GlobalFilters({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const [areas, setAreas] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    api<{ items: { code: string; name: string }[] }>('/areas')
      .then((r) => setAreas(r.items))
      .catch(() => {});
  }, []);

  const set = (k: keyof Filters, v: string) => onChange({ ...value, [k]: v || undefined });
  const year = new Date().getFullYear();

  return (
    <div className="card flex flex-wrap items-end gap-3">
      <Field label="Año">
        <select className="input" value={value.year ?? ''} onChange={(e) => set('year', e.target.value)}>
          <option value="">Todos</option>
          {[year, year - 1, year - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </Field>
      <Field label="Mes">
        <select className="input" value={value.month ?? ''} onChange={(e) => set('month', e.target.value)}>
          <option value="">Todos</option>
          {MONTHS.slice(1).map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
      </Field>
      <Field label="Área">
        <select className="input" value={value.area ?? ''} onChange={(e) => set('area', e.target.value)}>
          <option value="">Todas</option>
          {areas.map((a) => (
            <option key={a.code} value={a.code}>{a.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Origen">
        <select className="input" value={value.source ?? ''} onChange={(e) => set('source', e.target.value)}>
          <option value="">Todos</option>
          {['STOP', 'COMMISSION', 'INCIDENT', 'IPERC', 'EXCEL'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </Field>
      <button className="btn-ghost" onClick={() => onChange({})}>
        Limpiar
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-[120px]">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

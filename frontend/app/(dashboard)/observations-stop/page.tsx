'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { RiskBadge } from '@/components/RiskBadge';

const LEVELS = ['ACTO_INSEGURO', 'CONDICION_INSEGURA', 'CASI_INCIDENTE'];
const RISKS = ['BAJO', 'MEDIO', 'ALTO'];

interface Stop {
  _id?: string;
  folio: string;
  date: string;
  observer: string;
  area: string;
  machine?: string;
  description: string;
  level: string;
  risk: string;
  requiredAction?: string;
  responsible?: string;
  dueDate?: string;
}

const empty: Stop = {
  folio: '',
  date: new Date().toISOString().slice(0, 10),
  observer: '',
  area: '',
  description: '',
  level: 'ACTO_INSEGURO',
  risk: 'MEDIO',
};

export default function StopPage() {
  const [items, setItems] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Stop>(empty);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api<{ items: Stop[] }>('/observations-stop', { query: { limit: 100 } });
    setItems(res.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function edit(s: Stop) {
    setForm({ ...s, date: s.date?.slice(0, 10), dueDate: s.dueDate?.slice(0, 10) });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (form._id) {
        await api(`/observations-stop/${form._id}`, { method: 'PUT', body: form });
      } else {
        await api('/observations-stop', { method: 'POST', body: form });
      }
      setOpen(false);
      setForm(empty);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Observaciones STOP</h1>
          <p className="text-sm text-muted">Comportamiento seguro · alimenta la pirámide y el motor de acciones</p>
        </div>
        <button className="btn-primary" onClick={() => { setForm(empty); setOpen(true); }}>
          + Nueva observación
        </button>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-muted">
            <tr>
              {['Folio', 'Fecha', 'Observador', 'Área', 'Nivel', 'Riesgo', 'Responsable', ''].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">Sin registros</td></tr>
            ) : (
              items.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium">{s.folio}</td>
                  <td className="px-4 py-2">{fmtDate(s.date)}</td>
                  <td className="px-4 py-2">{s.observer}</td>
                  <td className="px-4 py-2">{s.area}</td>
                  <td className="px-4 py-2 text-xs">{s.level.replace('_', ' ')}</td>
                  <td className="px-4 py-2"><RiskBadge risk={s.risk} /></td>
                  <td className="px-4 py-2">{s.responsible ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="text-brand-light hover:underline text-xs" onClick={() => edit(s)}>Editar</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-50 p-4" onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={save}
            className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-3"
          >
            <h2 className="text-lg font-semibold">{form._id ? 'Editar' : 'Nueva'} observación STOP</h2>
            {error && <div className="badge bg-red-100 text-red-700 w-full justify-center py-2">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Folio" value={form.folio} onChange={(v) => setForm({ ...form, folio: v })} required />
              <Input label="Fecha" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} required />
              <Input label="Observador" value={form.observer} onChange={(v) => setForm({ ...form, observer: v })} required />
              <Input label="Área (código)" value={form.area} onChange={(v) => setForm({ ...form, area: v })} required />
              <Input label="Máquina" value={form.machine ?? ''} onChange={(v) => setForm({ ...form, machine: v })} />
              <Select label="Nivel" value={form.level} options={LEVELS} onChange={(v) => setForm({ ...form, level: v })} />
              <Select label="Riesgo" value={form.risk} options={RISKS} onChange={(v) => setForm({ ...form, risk: v })} />
              <Input label="Responsable" value={form.responsible ?? ''} onChange={(v) => setForm({ ...form, responsible: v })} />
              <Input label="Fecha compromiso" type="date" value={form.dueDate ?? ''} onChange={(v) => setForm({ ...form, dueDate: v })} />
            </div>
            <Textarea label="Descripción" value={form.description} onChange={(v) => setForm({ ...form, description: v })} required />
            <Textarea label="Acción requerida" value={form.requiredAction ?? ''} onChange={(v) => setForm({ ...form, requiredAction: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}{required && ' *'}</span>
      <input className="input" type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </label>
  );
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o.replace('_', ' ')}</option>)}
      </select>
    </label>
  );
}
function Textarea({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}{required && ' *'}</span>
      <textarea className="input min-h-[60px]" value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </label>
  );
}

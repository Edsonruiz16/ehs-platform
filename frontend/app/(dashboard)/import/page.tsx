'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const TARGETS = [
  { value: 'HEINRICH', label: 'Pirámide Heinrich (histórico)' },
  { value: 'STOP', label: 'Observaciones STOP' },
  { value: 'COMMISSION', label: 'Comisión Seg. e Higiene' },
  { value: 'INCIDENT', label: 'Incidentes / Accidentes' },
  { value: 'IPERC', label: 'Acciones IPERC' },
];

// Campos destino sugeridos por target (subset común).
const FIELDS: Record<string, string[]> = {
  HEINRICH: ['folio', 'date', 'level', 'severity', 'area', 'machine', 'description'],
  STOP: ['folio', 'date', 'observer', 'area', 'machine', 'description', 'level', 'risk', 'requiredAction', 'responsible', 'dueDate'],
  COMMISSION: ['folio', 'date', 'auditor', 'area', 'machine', 'description', 'level', 'risk', 'correctiveAction', 'responsible', 'dueDate'],
  INCIDENT: ['folio', 'eventDate', 'area', 'machine', 'person', 'description', 'level', 'severity', 'lostDays', 'rootCause', 'correctiveAction', 'responsible', 'dueDate'],
  IPERC: ['folio', 'date', 'area', 'process', 'machine', 'risk', 'riskLevel', 'description', 'requiredAction', 'responsible', 'dueDate', 'status'],
};

export default function ImportPage() {
  const [target, setTarget] = useState('HEINRICH');
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function doPreview() {
    if (!file) return;
    setError(''); setBusy(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api<{ columns: string[]; preview: any[] }>('/import/preview', { method: 'POST', body: fd, isForm: true });
      setColumns(res.columns);
      setPreview(res.preview);
      // Auto-mapeo por coincidencia de nombre.
      const auto: Record<string, string> = {};
      res.columns.forEach((c) => {
        const match = FIELDS[target].find((f) => f.toLowerCase() === c.toLowerCase().trim());
        if (match) auto[c] = match;
      });
      setMapping(auto);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function doImport() {
    if (!file) return;
    setError(''); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('target', target);
      fd.append('mapping', JSON.stringify(mapping));
      const res = await api<{ result: any }>('/import/commit', { method: 'POST', body: fd, isForm: true });
      setResult(res.result);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Importación de Excel</h1>

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Destino</span>
            <select className="input" value={target} onChange={(e) => { setTarget(e.target.value); setColumns([]); setResult(null); }}>
              {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Archivo (.xlsx / .xls)</span>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </label>
          <button className="btn-primary" disabled={!file || busy} onClick={doPreview}>
            {busy ? 'Procesando…' : '1. Vista previa'}
          </button>
        </div>
        {error && <div className="badge bg-red-100 text-red-700 py-2 px-3">{error}</div>}
      </div>

      {columns.length > 0 && (
        <div className="card space-y-3">
          <div className="card-title">2. Mapeo de columnas</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {columns.map((c) => (
              <label key={c} className="flex flex-col gap-1">
                <span className="text-xs font-medium truncate">{c}</span>
                <select
                  className="input"
                  value={mapping[c] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [c]: e.target.value })}
                >
                  <option value="">— ignorar —</option>
                  {FIELDS[target].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="overflow-x-auto">
            <div className="card-title mt-2">Vista previa (primeras filas)</div>
            <table className="w-full text-xs">
              <thead className="bg-slate-50"><tr>{columns.map((c) => <th key={c} className="px-2 py-1 text-left">{c}</th>)}</tr></thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {columns.map((c) => <td key={c} className="px-2 py-1">{String(row[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn-primary" disabled={busy} onClick={doImport}>3. Importar</button>
        </div>
      )}

      {result && (
        <div className="card space-y-2">
          <div className="card-title">Resultado de importación</div>
          <div className="flex gap-6">
            <div><span className="text-2xl font-bold">{result.total}</span><div className="text-xs text-muted">Total</div></div>
            <div><span className="text-2xl font-bold text-green-600">{result.inserted}</span><div className="text-xs text-muted">Importados</div></div>
            <div><span className="text-2xl font-bold text-red-600">{result.rejected.length}</span><div className="text-xs text-muted">Rechazados</div></div>
          </div>
          {result.rejected.length > 0 && (
            <table className="w-full text-xs mt-2">
              <thead className="bg-slate-50"><tr><th className="px-2 py-1 text-left">Fila</th><th className="px-2 py-1 text-left">Folio</th><th className="px-2 py-1 text-left">Motivo</th></tr></thead>
              <tbody>
                {result.rejected.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-slate-100"><td className="px-2 py-1">{r.row}</td><td className="px-2 py-1">{r.folio ?? '—'}</td><td className="px-2 py-1 text-red-600">{r.reason}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

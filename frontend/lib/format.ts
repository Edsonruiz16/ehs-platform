export const RISK_COLORS: Record<string, string> = {
  BAJO: '#16a34a',
  MEDIO: '#f59e0b',
  ALTO: '#dc2626',
};

export const STATUS_COLORS: Record<string, string> = {
  ABIERTA: '#dc2626',
  EN_PROCESO: '#f59e0b',
  CERRADA: '#16a34a',
};

export const LEVEL_COLORS = [
  '#16a34a', '#65a30d', '#ca8a04', '#f59e0b',
  '#ea580c', '#dc2626', '#b91c1c', '#7f1d1d',
];

export function fmtDate(d?: string | Date) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

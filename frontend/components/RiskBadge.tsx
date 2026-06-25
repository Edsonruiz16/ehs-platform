import { RISK_COLORS, STATUS_COLORS } from '@/lib/format';

export function RiskBadge({ risk }: { risk: string }) {
  const color = RISK_COLORS[risk] ?? '#64748b';
  return (
    <span className="badge" style={{ background: `${color}1a`, color }}>
      {risk}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? '#64748b';
  return (
    <span className="badge" style={{ background: `${color}1a`, color }}>
      {status?.replace('_', ' ')}
    </span>
  );
}

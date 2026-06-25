interface Props {
  label: string;
  value: string | number;
  hint?: string;
  color?: string;
}

export default function KpiCard({ label, value, hint, color = '#0f3d5e' }: Props) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="text-3xl font-bold" style={{ color }}>
        {value}
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

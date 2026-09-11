import type { ReactNode } from 'react';

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
};

export function MetricCard({ label, value, hint, icon }: MetricCardProps) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between text-ivory-muted">
        <span className="text-xs uppercase tracking-[0.24em]">{label}</span>
        <span>{icon}</span>
      </div>
      <div className="font-display text-3xl text-ivory">{value}</div>
      {hint ? <p className="mt-2 text-sm text-ivory-muted">{hint}</p> : null}
    </div>
  );
}

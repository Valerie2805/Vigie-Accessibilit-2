import type { Opportunity } from '@/types';

export function WhyNowCard({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
        Pourquoi agir maintenant
      </p>
      <p className="mt-4 text-sm leading-7 text-ivory-muted">{opportunity.whyNow}</p>
      <p className="mt-4 text-sm leading-7 text-ivory-muted">
        Ces signaux restent detectes automatiquement et demandent une confirmation par audit humain
        avant toute conclusion plus engageante.
      </p>
    </div>
  );
}

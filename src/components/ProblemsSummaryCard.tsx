import type { Opportunity } from '@/types';

function prettifyCategory(category: Opportunity['signals'][number]['category']) {
  return category.replace(/_/g, ' ');
}

export function ProblemsSummaryCard({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
        Signaux detectes automatiquement
      </p>

      <div className="mt-4 space-y-3">
        {opportunity.signals.length > 0 ? (
          opportunity.signals.map((signal) => (
            <div
              key={`${signal.category}-${signal.affectedPages.join('-')}`}
              className="rounded-2xl border border-white/10 bg-ink-soft p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong className="text-sm uppercase tracking-[0.18em] text-ivory">
                  {prettifyCategory(signal.category)}
                </strong>
                <span className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                  Gravite {signal.severity} · Confiance {signal.confidence}
                </span>
              </div>
              <p className="mt-2 text-sm text-ivory-muted">
                {signal.countEstimate} occurrence(s) estimee(s) sur {signal.affectedPages.length || 1}{' '}
                page(s) reperee(s).
              </p>
              {signal.affectedPages.length > 0 ? (
                <p className="mt-2 text-sm text-ivory-muted">
                  Pages touchees: {signal.affectedPages.join(', ')}
                </p>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-sm text-ivory-muted">
            Aucun signal structure n est encore disponible pour cette opportunite.
          </p>
        )}
      </div>
    </div>
  );
}

import type { Opportunity } from '@/types';

type ScoreExplanationPanelProps = {
  opportunity: Opportunity;
};

export function ScoreExplanationPanel({ opportunity }: ScoreExplanationPanelProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">Pourquoi ce score</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">Problemes</p>
          <p className="mt-3 font-display text-3xl text-ivory">
            {opportunity.scores.problemScore}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">Exposition</p>
          <p className="mt-3 font-display text-3xl text-ivory">
            {opportunity.scores.regulatoryExposureScore}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">Valeur</p>
          <p className="mt-3 font-display text-3xl text-ivory">
            {opportunity.scores.businessValueScore}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">Confiance</p>
          <p className="mt-3 font-display text-3xl text-ivory">
            {opportunity.scores.dataConfidenceScore}
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-3 text-sm leading-7 text-ivory-muted">
        {opportunity.explanations.map((explanation) => (
          <li key={explanation}>{explanation}</li>
        ))}
      </ul>
    </div>
  );
}

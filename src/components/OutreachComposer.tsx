import { Copy } from 'lucide-react';
import type { Opportunity } from '@/types';

type OutreachComposerProps = {
  opportunity: Opportunity;
  onCopy: (value: string, successMessage: string) => void;
  onRegenerate: () => void;
  loading?: boolean;
};

export function OutreachComposer({
  opportunity,
  onCopy,
  onRegenerate,
  loading = false,
}: OutreachComposerProps) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.28em] text-moss">Message pret a utiliser</p>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={loading}
          className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Regenerer
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm uppercase tracking-[0.18em] text-ivory">Objet d email</strong>
            <button
              type="button"
              onClick={() =>
                onCopy(opportunity.outreach.emailSubject, "Objet d'email copie.")
              }
              className="inline-flex items-center gap-2 text-sm text-copper-soft transition hover:text-copper"
            >
              <Copy className="h-4 w-4" />
              Copier
            </button>
          </div>
          <p className="mt-3 text-sm leading-7 text-ivory-muted">
            {opportunity.outreach.emailSubject}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm uppercase tracking-[0.18em] text-ivory">Email court</strong>
            <button
              type="button"
              onClick={() => onCopy(opportunity.outreach.emailBody, 'Email copie.')}
              className="inline-flex items-center gap-2 text-sm text-copper-soft transition hover:text-copper"
            >
              <Copy className="h-4 w-4" />
              Copier
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7 text-ivory-muted">
            {opportunity.outreach.emailBody}
          </pre>
        </div>

        <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm uppercase tracking-[0.18em] text-ivory">
              Message LinkedIn
            </strong>
            <button
              type="button"
              onClick={() =>
                onCopy(opportunity.outreach.linkedinMessage, 'Message LinkedIn copie.')
              }
              className="inline-flex items-center gap-2 text-sm text-copper-soft transition hover:text-copper"
            >
              <Copy className="h-4 w-4" />
              Copier
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7 text-ivory-muted">
            {opportunity.outreach.linkedinMessage}
          </pre>
        </div>
      </div>
    </div>
  );
}

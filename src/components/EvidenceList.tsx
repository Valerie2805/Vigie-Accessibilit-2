import { ExternalLink, FileSearch, Link2 } from 'lucide-react';
import type { ScanEvidence } from '@/types';

type EvidenceListProps = {
  evidences: ScanEvidence[];
};

export function EvidenceList({ evidences }: EvidenceListProps) {
  if (evidences.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 p-6 text-sm text-ivory-muted">
        Aucun signal public d'accessibilite n'a ete detecte automatiquement.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evidences.map((evidence) => (
        <article
          key={evidence.id}
          className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-copper/30 bg-copper/10 p-2 text-copper-soft">
                {evidence.kind === 'page_accessibilite' ? (
                  <Link2 className="h-4 w-4" />
                ) : (
                  <FileSearch className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ivory">{evidence.label}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                  {evidence.kind.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <a
              href={evidence.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm text-copper-soft transition hover:text-copper"
            >
              Ouvrir la preuve
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {evidence.excerpt ? (
            <p className="mt-4 rounded-2xl border border-white/10 bg-ink-soft px-4 py-3 text-sm text-ivory-muted">
              {evidence.excerpt}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

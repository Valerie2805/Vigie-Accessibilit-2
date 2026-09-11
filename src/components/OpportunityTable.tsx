import { ArrowRight, Copy, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { OpportunityScoreBadge } from '@/components/OpportunityScoreBadge';
import { OpportunityStatusSelector } from '@/components/OpportunityStatusSelector';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import type { Opportunity, OpportunityStatus } from '@/types';
import { getOpportunityOfferLabel } from '@/utils/format';

type OpportunityTableProps = {
  opportunities: Opportunity[];
  onCopyMessage: (opportunity: Opportunity) => void;
  onRecompute: (opportunity: Opportunity) => void;
  onStatusChange: (opportunity: Opportunity, status: OpportunityStatus) => void;
  selectedIds: string[];
  onToggleSelection: (opportunityId: string) => void;
  busyId?: string | null;
};

export function OpportunityTable({
  opportunities,
  onCopyMessage,
  onRecompute,
  onStatusChange,
  selectedIds,
  onToggleSelection,
  busyId = null,
}: OpportunityTableProps) {
  return (
    <div className="space-y-4">
      {opportunities.map((opportunity) => (
        <article
          key={opportunity.id}
          className="rounded-[24px] border border-white/10 bg-ink-soft p-5"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.18em] text-ivory-muted">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(opportunity.id)}
                    onChange={() => onToggleSelection(opportunity.id)}
                    className="h-4 w-4 rounded border-white/20 bg-ink-soft"
                  />
                  Selection
                </label>
                <h3 className="font-display text-2xl text-ivory">{opportunity.site.name}</h3>
                <OpportunityScoreBadge
                  score={opportunity.scores.leadScore}
                  label={opportunity.scores.leadLabel}
                />
                <UrgencyBadge urgency={opportunity.scores.regulatoryUrgency} />
                <ConfidenceBadge confidence={opportunity.scan.confidence} />
              </div>

              <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-ivory-muted">
                <span>{opportunity.site.country}</span>
                <span>{opportunity.site.sector ?? 'Secteur a confirmer'}</span>
                <span>{getOpportunityOfferLabel(opportunity.recommendedOffer.primary)}</span>
                <span>{opportunity.site.siteType}</span>
              </div>

              <p className="max-w-3xl text-sm leading-7 text-ivory-muted">{opportunity.whyNow}</p>
            </div>

            <div className="flex flex-col items-start gap-3 xl:items-end">
              <OpportunityStatusSelector
                value={opportunity.status}
                onChange={(status) => onStatusChange(opportunity, status)}
                disabled={busyId === opportunity.id}
              />

              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/opportunites/${opportunity.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                >
                  Voir
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <button
                  type="button"
                  onClick={() => onCopyMessage(opportunity)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
                >
                  <Copy className="h-4 w-4" />
                  Copier le message
                </button>

                <button
                  type="button"
                  onClick={() => onRecompute(opportunity)}
                  disabled={busyId === opportunity.id}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  Recalculer
                </button>

              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

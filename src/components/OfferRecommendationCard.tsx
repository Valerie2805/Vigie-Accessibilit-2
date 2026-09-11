import type { Opportunity } from '@/types';
import { getOpportunityOfferLabel } from '@/utils/format';

export function OfferRecommendationCard({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-moss">Offre la plus pertinente</p>
      <h3 className="mt-4 font-display text-2xl text-ivory">
        {getOpportunityOfferLabel(opportunity.recommendedOffer.primary)}
      </h3>
      {opportunity.recommendedOffer.secondary ? (
        <p className="mt-3 text-sm text-ivory-muted">
          Option secondaire: {getOpportunityOfferLabel(opportunity.recommendedOffer.secondary)}
        </p>
      ) : null}
      <p className="mt-4 text-sm leading-7 text-ivory-muted">
        {opportunity.recommendedOffer.reason}
      </p>
    </div>
  );
}

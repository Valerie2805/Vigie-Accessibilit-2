import type { OpportunityConfidence } from '@/types';
import { cn } from '@/lib/utils';
import { getOpportunityConfidenceLabel } from '@/utils/format';

type ConfidenceBadgeProps = {
  confidence: OpportunityConfidence;
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]',
        confidence === 'high' && 'border-moss/40 bg-moss/10 text-moss',
        confidence === 'medium' && 'border-copper/40 bg-copper/10 text-copper-soft',
        confidence === 'low' && 'border-white/10 bg-white/5 text-ivory-muted',
      )}
    >
      {getOpportunityConfidenceLabel(confidence)}
    </span>
  );
}

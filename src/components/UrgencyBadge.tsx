import type { OpportunityUrgency } from '@/types';
import { cn } from '@/lib/utils';
import { getOpportunityUrgencyLabel } from '@/utils/format';

type UrgencyBadgeProps = {
  urgency: OpportunityUrgency;
};

export function UrgencyBadge({ urgency }: UrgencyBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]',
        urgency === 'elevee' && 'border-rose-300/30 bg-rose-300/10 text-rose-200',
        urgency === 'moyenne' && 'border-copper/40 bg-copper/10 text-copper-soft',
        urgency === 'faible' && 'border-moss/40 bg-moss/10 text-moss',
      )}
    >
      {getOpportunityUrgencyLabel(urgency)}
    </span>
  );
}

import type { OpportunityLeadLabel } from '@/types';
import { cn } from '@/lib/utils';
import { getOpportunityLeadLabel } from '@/utils/format';

type OpportunityScoreBadgeProps = {
  score: number;
  label: OpportunityLeadLabel;
};

export function OpportunityScoreBadge({ score, label }: OpportunityScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]',
        label === 'chaud' && 'border-rose-300/30 bg-rose-300/10 text-rose-200',
        label === 'tiede' && 'border-copper/40 bg-copper/10 text-copper-soft',
        label === 'froid' && 'border-moss/40 bg-moss/10 text-moss',
      )}
    >
      {getOpportunityLeadLabel(label)} {score}
    </span>
  );
}

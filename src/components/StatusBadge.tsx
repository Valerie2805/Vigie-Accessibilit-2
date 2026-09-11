import type { EligibilityStatus, ScanStatus } from '@/types';
import { cn } from '@/lib/utils';
import { getEligibilityLabel, getScanStatusLabel } from '@/utils/format';

type StatusBadgeProps = {
  status: EligibilityStatus | ScanStatus;
  type: 'eligibility' | 'scan';
};

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const isPositive =
    status === 'elements_detectes' || status === 'hors_perimetre_probable';
  const isWarning =
    status === 'elements_partiels' || status === 'incertain';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]',
        isPositive && 'border-moss/40 bg-moss/10 text-moss',
        isWarning && 'border-copper/40 bg-copper/10 text-copper-soft',
        !isPositive &&
          !isWarning &&
          'border-rose-300/30 bg-rose-300/10 text-rose-200',
      )}
    >
      {type === 'eligibility'
        ? getEligibilityLabel(status as EligibilityStatus)
        : getScanStatusLabel(status as ScanStatus)}
    </span>
  );
}

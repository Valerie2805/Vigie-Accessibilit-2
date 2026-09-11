import type { OpportunityStatus } from '@/types';
import { getOpportunityStatusLabel } from '@/utils/format';

const statuses: OpportunityStatus[] = ['new', 'reviewed', 'contacted', 'qualified', 'discarded'];

type OpportunityStatusSelectorProps = {
  value: OpportunityStatus;
  onChange: (value: OpportunityStatus) => void;
  disabled?: boolean;
};

export function OpportunityStatusSelector({
  value,
  onChange,
  disabled = false,
}: OpportunityStatusSelectorProps) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
      <span>Statut</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as OpportunityStatus)}
        disabled={disabled}
        className="bg-transparent text-sm text-ivory outline-none disabled:opacity-50"
      >
        {statuses.map((status) => (
          <option key={status} value={status} className="bg-ink text-ivory">
            {getOpportunityStatusLabel(status)}
          </option>
        ))}
      </select>
    </label>
  );
}

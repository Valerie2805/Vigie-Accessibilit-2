import type { OpportunityOffer, OpportunityStatus, OpportunityUrgency } from '@/types';
import { getOpportunityOfferLabel, getOpportunityStatusLabel } from '@/utils/format';

export type OpportunityFiltersValue = {
  query: string;
  minimumScore: string;
  urgency: 'tous' | OpportunityUrgency;
  status: 'tous' | OpportunityStatus;
  offer: 'tous' | OpportunityOffer;
  country: string;
  sector: string;
};

type OpportunityFiltersProps = {
  value: OpportunityFiltersValue;
  onChange: (value: OpportunityFiltersValue) => void;
  sectors: string[];
  countries: string[];
};

const offers: OpportunityOffer[] = [
  'audit_flash',
  'audit_complet',
  'audit_complet_plus_remediation',
  'mise_en_conformite_rgaa_eaa',
  'monitoring_continu',
  'formation_plus_accompagnement',
  'audit_design_system_front',
];

const statuses: OpportunityStatus[] = ['new', 'reviewed', 'contacted', 'qualified', 'discarded'];
const urgencies: OpportunityUrgency[] = ['faible', 'moyenne', 'elevee'];

export function OpportunityFilters({
  value,
  onChange,
  sectors,
  countries,
}: OpportunityFiltersProps) {
  function patch(partial: Partial<OpportunityFiltersValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">Recherche</span>
        <input
          value={value.query}
          onChange={(event) => patch({ query: event.target.value })}
          placeholder="Site, domaine, secteur..."
          className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">Score minimum</span>
        <input
          type="number"
          min="0"
          max="100"
          value={value.minimumScore}
          onChange={(event) => patch({ minimumScore: event.target.value })}
          placeholder="0"
          className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
        />
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">Urgence</span>
        <select
          value={value.urgency}
          onChange={(event) =>
            patch({ urgency: event.target.value as OpportunityFiltersValue['urgency'] })
          }
          className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
        >
          <option value="tous" className="bg-ink text-ivory">
            Toutes
          </option>
          {urgencies.map((urgency) => (
            <option key={urgency} value={urgency} className="bg-ink text-ivory">
              {urgency}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">Statut</span>
        <select
          value={value.status}
          onChange={(event) =>
            patch({ status: event.target.value as OpportunityFiltersValue['status'] })
          }
          className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
        >
          <option value="tous" className="bg-ink text-ivory">
            Tous
          </option>
          {statuses.map((status) => (
            <option key={status} value={status} className="bg-ink text-ivory">
              {getOpportunityStatusLabel(status)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">Offre</span>
        <select
          value={value.offer}
          onChange={(event) => patch({ offer: event.target.value as OpportunityFiltersValue['offer'] })}
          className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
        >
          <option value="tous" className="bg-ink text-ivory">
            Toutes
          </option>
          {offers.map((offer) => (
            <option key={offer} value={offer} className="bg-ink text-ivory">
              {getOpportunityOfferLabel(offer)}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">Pays</span>
        <select
          value={value.country}
          onChange={(event) => patch({ country: event.target.value })}
          className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
        >
          <option value="" className="bg-ink text-ivory">
            Tous
          </option>
          {countries.map((country) => (
            <option key={country} value={country} className="bg-ink text-ivory">
              {country}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">Secteur</span>
        <select
          value={value.sector}
          onChange={(event) => patch({ sector: event.target.value })}
          className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
        >
          <option value="" className="bg-ink text-ivory">
            Tous
          </option>
          {sectors.map((sector) => (
            <option key={sector} value={sector} className="bg-ink text-ivory">
              {sector}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

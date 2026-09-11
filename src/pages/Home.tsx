import { useMemo, useState } from 'react';
import { ArrowRight, Globe, Mail, Radar, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import {
  exportCompaniesToCsv,
  exportCompaniesToExcel,
} from '@/utils/export-companies';
import { saveRecentCompaniesToBrowser } from '@/utils/local-company-history';
import { resolveWebsite, searchCompanies } from '@/utils/api';
import {
  formatCurrency,
  getEffectifLabel,
  getEligibilityLabel,
  getScanStatusLabel,
} from '@/utils/format';
import type { Company, EligibilityStatus, ScanStatus } from '@/types';

type EligibilityFilter = 'tous' | EligibilityStatus;
type AccessibilityFilter = 'tous' | 'sans_analyse' | ScanStatus;

type ClientSearchPreset = {
  value: string;
  label: string;
  group: string;
  query?: string;
  nafCodes?: string[];
  helperText?: string;
};

const RGAA_KEYWORDS_DOWNLOAD_URL = '/mots-cles-prospects-rgaa.csv';
const ACCESSIBILITY_PROSPECT_NAF_CODES = [
  '62.01Z',
  '62.02A',
  '62.02B',
  '70.22Z',
  '74.10Z',
  '85.59A',
];
const ACCESSIBILITY_PROSPECT_KEYWORDS: Array<{ keyword: string; weight: number }> = [
  { keyword: 'accessibil', weight: 8 },
  { keyword: 'rgaa', weight: 10 },
  { keyword: 'wcag', weight: 10 },
  { keyword: 'a11y', weight: 10 },
  { keyword: 'handicap', weight: 6 },
  { keyword: 'inclus', weight: 5 },
  { keyword: 'audit', weight: 4 },
  { keyword: 'conformit', weight: 4 },
  { keyword: 'formation', weight: 3 },
  { keyword: 'ergonomi', weight: 3 },
  { keyword: 'ux', weight: 2 },
  { keyword: 'ui', weight: 2 },
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getAccessibilityProspectPriority(company: Company) {
  const haystack = normalizeText(
    [company.nom, company.activite, company.adresse, company.websiteUrl, company.email]
      .filter(Boolean)
      .join(' '),
  );

  let score = 0;

  for (const rule of ACCESSIBILITY_PROSPECT_KEYWORDS) {
    if (haystack.includes(rule.keyword)) {
      score += rule.weight;
    }
  }

  if (company.websiteUrl) {
    score += 1;
  }

  if (company.email) {
    score += 1;
  }

  return score;
}

function sortCompaniesForPreset(companies: Company[], preset?: ClientSearchPreset) {
  if (!preset || preset.group !== 'Prospects accessibilite') {
    return companies;
  }

  return [...companies].sort((left, right) => {
    const scoreDifference =
      getAccessibilityProspectPriority(right) - getAccessibilityProspectPriority(left);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const websiteDifference = Number(Boolean(right.websiteUrl)) - Number(Boolean(left.websiteUrl));
    if (websiteDifference !== 0) {
      return websiteDifference;
    }

    const revenueDifference = (right.chiffreAffaires ?? 0) - (left.chiffreAffaires ?? 0);
    if (revenueDifference !== 0) {
      return revenueDifference;
    }

    return left.nom.localeCompare(right.nom, 'fr');
  });
}

const clientSearchPresets: ClientSearchPreset[] = [
  {
    value: 'agence-web',
    label: 'Agence web',
    group: 'Agences web',
    query: 'agence web',
  },
  {
    value: 'creation-site-internet',
    label: 'Creation site internet',
    group: 'Agences web',
    query: 'creation site internet',
  },
  {
    value: 'refonte-site-internet',
    label: 'Refonte site internet',
    group: 'Agences web',
    query: 'refonte site internet',
  },
  {
    value: 'studio-digital',
    label: 'Studio digital',
    group: 'Studios / freelances structures',
    query: 'studio digital',
  },
  {
    value: 'studio-web',
    label: 'Studio web',
    group: 'Studios / freelances structures',
    query: 'studio web',
  },
  {
    value: 'wordpress',
    label: 'WordPress',
    group: 'Studios / freelances structures',
    query: 'WordPress',
  },
  {
    value: 'site-vitrine',
    label: 'Site vitrine',
    group: 'Studios / freelances structures',
    query: 'site vitrine',
  },
  {
    value: 'communication-digitale',
    label: 'Communication digitale',
    group: 'Communication digitale',
    query: 'communication digitale',
  },
  {
    value: 'marketing-digital',
    label: 'Marketing digital',
    group: 'Communication digitale',
    query: 'marketing digital',
  },
  {
    value: 'strategie-digitale',
    label: 'Strategie digitale',
    group: 'Communication digitale',
    query: 'strategie digitale',
  },
  {
    value: 'bet',
    label: "BET (Bureau d'etudes Techniques)",
    group: 'BTP / ingenierie',
    nafCodes: ['71.12B'],
  },
  {
    value: 'entreprise-generale-construction',
    label: 'Entreprise generale de construction',
    group: 'BTP / ingenierie',
    nafCodes: ['41.20A', '41.20B', '42.99Z'],
  },
  {
    value: 'ingenierie-batiment',
    label: 'Ingenierie du batiment',
    group: 'BTP / ingenierie',
    nafCodes: ['71.12B'],
  },
  {
    value: 'prestataires-accessibilite-large',
    label: 'Prestataires accessibilite (large)',
    group: 'Prospects accessibilite',
    nafCodes: ACCESSIBILITY_PROSPECT_NAF_CODES,
    helperText:
      "Recherche large dans les secteurs web, conseil, design et formation. Utilise ensuite les filtres deja presents comme ville, departement et effectif pour resserrer.",
  },
  {
    value: 'agences-esn-accessibilite',
    label: 'Agences / ESN / dev web',
    group: 'Prospects accessibilite',
    nafCodes: ['62.01Z', '62.02A', '62.02B'],
    helperText:
      "Cible les agences web, studios techniques et ESN susceptibles de proposer une offre accessibilite.",
  },
  {
    value: 'conseil-formation-accessibilite',
    label: 'Conseil / formation',
    group: 'Prospects accessibilite',
    nafCodes: ['70.22Z', '85.59A'],
    helperText:
      "Cible les cabinets de conseil et organismes de formation qui peuvent vendre des audits, accompagnements ou sensibilisations.",
  },
  {
    value: 'design-ux-inclusif',
    label: 'Design / UX inclusif',
    group: 'Prospects accessibilite',
    nafCodes: ['74.10Z'],
    helperText:
      "Cible les studios design, UX et UI qui peuvent etre sensibles aux sujets d'inclusion et d'accessibilite numerique.",
  },
  {
    value: 'rgaa-mot-cle',
    label: 'RGAA (mot-cle exact)',
    group: 'Prospects accessibilite',
    query: 'RGAA',
    helperText:
      "Recherche tres stricte. A utiliser seulement si tu veux des structures qui mentionnent explicitement RGAA dans leur fiche.",
  },
  {
    value: 'accessibilite-numerique-mot-cle',
    label: 'Accessibilite numerique',
    group: 'Prospects accessibilite',
    query: 'accessibilite numerique',
    helperText:
      "Recherche textuelle plus stricte que le preset large. Utile pour retrouver des structures qui emploient deja ce vocabulaire.",
  },
  {
    value: 'audit-rgaa-mot-cle',
    label: 'Audit RGAA',
    group: 'Prospects accessibilite',
    query: 'audit RGAA',
    helperText:
      "Recherche textuelle tres ciblee pour les prestataires qui affichent explicitement cette offre.",
  },
  {
    value: 'wcag-mot-cle',
    label: 'WCAG',
    group: 'Prospects accessibilite',
    query: 'WCAG accessibilite',
    helperText:
      "Recherche textuelle utile pour les acteurs plus internationaux ou plus techniques.",
  },
];

const clientSearchOptions = [
  {
    label: 'Agences web',
    options: clientSearchPresets.filter((option) => option.group === 'Agences web'),
  },
  {
    label: 'Studios / freelances structures',
    options: clientSearchPresets.filter(
      (option) => option.group === 'Studios / freelances structures',
    ),
  },
  {
    label: 'Communication digitale',
    options: clientSearchPresets.filter((option) => option.group === 'Communication digitale'),
  },
  {
    label: 'BTP / ingenierie',
    options: clientSearchPresets.filter((option) => option.group === 'BTP / ingenierie'),
  },
  {
    label: 'Prospects accessibilite',
    options: clientSearchPresets.filter(
      (option) => option.group === 'Prospects accessibilite',
    ),
  },
];

const activityOptions = [
  { value: '', label: 'Tous les corps de metiers' },
  { value: 'banque', label: 'Banque' },
  { value: 'assurance', label: 'Assurance' },
  { value: 'mutuelle', label: 'Mutuelle' },
  { value: 'e-commerce', label: 'E-commerce' },
  { value: 'transport', label: 'Transport de voyageurs' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'service public', label: 'Service public' },
  { value: 'mission de service public', label: 'Mission de service public' },
  { value: 'sante privee', label: 'Sante privee' },
  { value: 'energie', label: 'Energie' },
  { value: 'eau services essentiels', label: 'Eau et services essentiels' },
  { value: 'grande distribution', label: 'Grande distribution' },
  { value: 'tourisme hotellerie', label: 'Tourisme et hotellerie' },
  { value: 'immobilier', label: 'Immobilier' },
  { value: 'travaux publics', label: 'Travaux publics' },
  { value: 'education formation', label: 'Education et formation' },
  { value: 'medias audiovisuel', label: 'Medias et audiovisuel' },
  { value: 'livres numeriques', label: 'Livres numeriques' },
  { value: 'autre', label: 'Autre activite' },
] as const;

export default function Home() {
  const [query, setQuery] = useState('');
  const [selectedClientSearch, setSelectedClientSearch] = useState('');
  const [city, setCity] = useState('');
  const [department, setDepartment] = useState('');
  const [searchScope, setSearchScope] = useState<'france' | 'city' | 'department'>('france');
  const [selectedActivity, setSelectedActivity] = useState('');
  const [customActivity, setCustomActivity] = useState('');
  const [nafCode, setNafCode] = useState('');
  const [minRevenue, setMinRevenue] = useState('');
  const [maxRevenue, setMaxRevenue] = useState('');
  const [minEmployees, setMinEmployees] = useState('');
  const [maxEmployees, setMaxEmployees] = useState('');
  const [companySize, setCompanySize] = useState<'tous' | 'pme' | 'ge'>('tous');
  const [eligibilityFilter, setEligibilityFilter] = useState<EligibilityFilter>('tous');
  const [accessibilityFilter, setAccessibilityFilter] =
    useState<AccessibilityFilter>('tous');
  const [results, setResults] = useState<Company[]>([]);
  const [selectedSirens, setSelectedSirens] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metier = selectedActivity === 'autre' ? customActivity : selectedActivity;
  const selectedClientPreset = clientSearchPresets.find(
    (option) => option.value === selectedClientSearch,
  );
  const hasSearchCriteria =
    query.trim().length >= 2 ||
    metier.trim().length >= 2 ||
    nafCode.trim().length >= 4 ||
    (searchScope === 'city' && city.trim().length >= 2) ||
    (searchScope === 'department' && department.trim().length >= 2);

  const filteredResults = useMemo(() => {
    return results.filter((company) => {
      const matchesEligibility =
        eligibilityFilter === 'tous' || company.eligibility === eligibilityFilter;

      const matchesAccessibility =
        accessibilityFilter === 'tous' ||
        (accessibilityFilter === 'sans_analyse'
          ? !company.latestScanStatus
          : company.latestScanStatus === accessibilityFilter);

      return matchesEligibility && matchesAccessibility;
    });
  }, [accessibilityFilter, eligibilityFilter, results]);

  const selectedResults = useMemo(
    () => filteredResults.filter((company) => selectedSirens.includes(company.siren)),
    [filteredResults, selectedSirens],
  );

  async function enrichCompanies(targetCompanies: Company[]) {
    const targets = targetCompanies.filter((company) => !company.websiteUrl || !company.email);
    if (targets.length === 0) {
      return;
    }

    setEnriching(true);
    setEnrichProgress({ done: 0, total: targets.length });
    setError(null);
    let failureCount = 0;

    try {
      for (const [index, company] of targets.entries()) {
        try {
          const response = await resolveWebsite(company.siren, company.websiteUrl ?? undefined);
          const updatedCompany = {
            ...company,
            websiteUrl: response.company.websiteUrl,
            websiteSource: response.company.websiteSource,
            websiteConfidence: response.company.websiteConfidence,
            websiteRedesignYear: response.company.websiteRedesignYear,
            email: response.company.email,
            latestScanStatus:
              response.company.latestScanStatus ?? company.latestScanStatus ?? null,
            latestScannedAt:
              response.company.latestScannedAt ?? company.latestScannedAt ?? null,
          };

          setResults((current) =>
            current.map((item) =>
              item.siren === company.siren ? updatedCompany : item,
            ),
          );
          saveRecentCompaniesToBrowser([updatedCompany]);
        } catch {
          failureCount += 1;
        } finally {
          setEnrichProgress({
            done: index + 1,
            total: targets.length,
          });
        }
      }

      if (failureCount > 0) {
        setError(
          `Impossible de completer ${failureCount} entreprise${
            failureCount > 1 ? 's' : ''
          } pour le moment. Clique de nouveau sur "Completer les sites" pour relancer les recherches restantes.`,
        );
      }
    } finally {
      setEnriching(false);
      setEnrichProgress(null);
    }
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await searchCompanies(
        query,
        searchScope === 'city' ? city : undefined,
        searchScope === 'department' ? department : undefined,
        metier,
        nafCode,
        minRevenue ? Number(minRevenue) : undefined,
        maxRevenue ? Number(maxRevenue) : undefined,
        minEmployees ? Number(minEmployees) : undefined,
        maxEmployees ? Number(maxEmployees) : undefined,
      );
      const sortedResults = sortCompaniesForPreset(response.results, selectedClientPreset);
      setResults(sortedResults);
      setSelectedSirens([]);
      saveRecentCompaniesToBrowser(sortedResults);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'La recherche a echoue.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrichWebsites() {
    await enrichCompanies(selectedResults.length > 0 ? selectedResults : results);
  }

  async function handleExportCsv() {
    if (selectedResults.length === 0 || exporting) return;
    setExporting(true);
    setError(null);

    try {
      exportCompaniesToCsv(selectedResults);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Impossible d'exporter.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    if (selectedResults.length === 0 || exporting) return;
    setExporting(true);
    setError(null);

    try {
      exportCompaniesToExcel(selectedResults);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Impossible d'exporter.",
      );
    } finally {
      setExporting(false);
    }
  }

  function toggleCompanySelection(siren: string) {
    setSelectedSirens((current) =>
      current.includes(siren)
        ? current.filter((item) => item !== siren)
        : [...current, siren],
    );
  }

  function handleSelectAllFiltered() {
    const filteredSirens = filteredResults.map((company) => company.siren);
    const allFilteredSelected =
      filteredSirens.length > 0 &&
      filteredSirens.every((siren) => selectedSirens.includes(siren));

    setSelectedSirens((current) => {
      if (allFilteredSelected) {
        return current.filter((siren) => !filteredSirens.includes(siren));
      }

      return Array.from(new Set([...current, ...filteredSirens]));
    });
  }

  return (
    <AppShell
      eyebrow="MVP de veille accessibilite"
      title="Repere les entreprises a surveiller et les sites qui n'exposent pas leurs preuves publiques."
      description="Recherche une entreprise francaise, estime son exposition au cadre accessibilite et lance un scan cible de son site pour trouver declaration, page accessibilite, mention d'etat de conformite et mecanisme de contact."
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <form
          onSubmit={handleSearch}
          className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                Recherche guidee
              </p>
              <h2 className="mt-2 font-display text-3xl text-ivory">
                Trouver une entreprise
              </h2>
            </div>
            <div className="rounded-full border border-copper/30 bg-copper/10 p-3 text-copper-soft">
              <Search className="h-5 w-5" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Nom, raison sociale ou SIREN
              </span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  if (
                    event.target.value !== selectedClientPreset?.query ||
                    selectedClientPreset?.nafCodes?.length
                  ) {
                    setSelectedClientSearch('');
                  }
                }}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="Ex. La Poste, LVMH, 356000000"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Recherche client
              </span>
              <select
                value={selectedClientSearch}
                onChange={(event) => {
                  const selectedOption = clientSearchPresets.find(
                    (option) => option.value === event.target.value,
                  );

                  setSelectedClientSearch(event.target.value);
                  setQuery(selectedOption?.query ?? '');
                  setNafCode(selectedOption?.nafCodes?.join(',') ?? '');
                }}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
              >
                <option value="" className="bg-ink text-ivory">
                  Choisir une recherche client
                </option>
                {clientSearchOptions.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-ink text-ivory"
                      >
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <a
                href={RGAA_KEYWORDS_DOWNLOAD_URL}
                download
                className="inline-flex pt-2 text-xs uppercase tracking-[0.16em] text-copper-soft transition hover:text-copper"
              >
                Telecharger la liste Excel compatible des mots-cles RGAA
              </a>
              {selectedClientPreset?.helperText ? (
                <p className="pt-2 text-sm leading-6 text-ivory-muted">
                  {selectedClientPreset.helperText}
                </p>
              ) : null}
            </label>

            <div className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Zone de recherche
              </span>
              <div className="flex items-center rounded-2xl border border-white/10 bg-ink-soft p-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setSearchScope('france');
                    setCity('');
                    setDepartment('');
                  }}
                  className={
                    searchScope === 'france'
                      ? 'flex-1 rounded-xl bg-copper px-4 py-3 font-medium text-ink'
                      : 'flex-1 rounded-xl px-4 py-3 text-ivory-muted transition hover:text-ivory'
                  }
                >
                  Toute la France
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope('city')}
                  className={
                    searchScope === 'city'
                      ? 'flex-1 rounded-xl bg-white/10 px-4 py-3 font-medium text-ivory'
                      : 'flex-1 rounded-xl px-4 py-3 text-ivory-muted transition hover:text-ivory'
                  }
                >
                  Une ville
                </button>
                <button
                  type="button"
                  onClick={() => setSearchScope('department')}
                  className={
                    searchScope === 'department'
                      ? 'flex-1 rounded-xl bg-white/10 px-4 py-3 font-medium text-ivory'
                      : 'flex-1 rounded-xl px-4 py-3 text-ivory-muted transition hover:text-ivory'
                  }
                >
                  Un departement
                </button>
              </div>
            </div>

            {searchScope === 'city' ? (
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                  Ville
                </span>
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                  placeholder="Paris"
                />
              </label>
            ) : searchScope === 'department' ? (
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                  Departement
                </span>
                <input
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                  placeholder="75, 69, 13, 974..."
                />
              </label>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-ink-soft px-4 py-4 text-sm text-ivory-muted">
                La recherche se fera sur toute la France.
              </div>
            )}

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Activite
              </span>
              <select
                value={selectedActivity}
                onChange={(event) => {
                  setSelectedActivity(event.target.value);
                  if (event.target.value !== 'autre') {
                    setCustomActivity('');
                  }
                }}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
              >
                {activityOptions.map((option) => (
                  <option
                    key={option.value || 'all'}
                    value={option.value}
                    className="bg-ink text-ivory"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {selectedActivity === 'autre' ? (
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                  Autre activite
                </span>
                <input
                  value={customActivity}
                  onChange={(event) => setCustomActivity(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                  placeholder="Ex. fleuriste, boulangerie, coiffure"
                />
              </label>
            ) : null}

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Taille
              </span>
              <select
                value={companySize}
                onChange={(event) => {
                  const next = event.target.value as 'tous' | 'pme' | 'ge';
                  setCompanySize(next);

                  if (next === 'tous') {
                    return;
                  }

                  if (next === 'pme') {
                    // Raccourci: PME = moins de 250 salariés.
                    // On ne force pas le min, pour inclure aussi les très petites structures.
                    setMaxEmployees((current) => (current.trim() ? current : '249'));
                    return;
                  }

                  if (next === 'ge') {
                    // Raccourci: GE = très grande entreprise.
                    setMinEmployees((current) => (current.trim() ? current : '5000'));
                    setMaxEmployees('');
                  }
                }}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
              >
                <option value="tous" className="bg-ink text-ivory">
                  Toutes
                </option>
                <option value="pme" className="bg-ink text-ivory">
                  PME
                </option>
                <option value="ge" className="bg-ink text-ivory">
                  GE
                </option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Code NAF
              </span>
              <input
                value={nafCode}
                onChange={(event) => {
                  setNafCode(event.target.value);
                  if (selectedClientPreset?.nafCodes?.join(',') !== event.target.value) {
                    setSelectedClientSearch('');
                  }
                }}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="41.20B ou 71.12B,41.20A"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                CA minimum
              </span>
              <input
                value={minRevenue}
                onChange={(event) => setMinRevenue(event.target.value)}
                type="number"
                min="0"
                step="1000"
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="1000000"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                CA maximum
              </span>
              <input
                value={maxRevenue}
                onChange={(event) => setMaxRevenue(event.target.value)}
                type="number"
                min="0"
                step="1000"
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="5000000"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Salaries minimum
              </span>
              <input
                value={minEmployees}
                onChange={(event) => setMinEmployees(event.target.value)}
                type="number"
                min="0"
                step="1"
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="10"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted">
                Salaries maximum
              </span>
              <input
                value={maxEmployees}
                onChange={(event) => setMaxEmployees(event.target.value)}
                type="number"
                min="0"
                step="1"
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-soft px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                placeholder="250"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={
                loading || !hasSearchCriteria
              }
              className="inline-flex h-12 items-center gap-2 rounded-full bg-copper px-5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Spinner />
              ) : (
                <Radar className="h-4 w-4" />
              )}
              Lancer la recherche
            </button>
            <p className="text-sm text-ivory-muted">
              Recherche sur toute la France par defaut, puis filtrage optionnel par
              ville, departement, activite, code NAF, chiffre d'affaires et
              nombre de salaries quand ces donnees existent. Pour les presets
              `Prospects accessibilite`, commence par `Prestataires accessibilite (large)`
              puis resserre avec tes filtres existants.
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </form>

        <aside className="rounded-[28px] border border-white/10 bg-gradient-to-br from-moss/10 via-white/5 to-transparent p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-moss">
            Ce que fait ce scan
          </p>
          <ul className="mt-5 space-y-4 text-sm leading-7 text-ivory-muted">
            <li>Recherche l'entreprise et recupere ses informations ouvertes.</li>
            <li>Estime si elle semble dans le radar legal ou dans une zone incertaine.</li>
            <li>Recherche un site officiel automatiquement ou accepte une URL manuelle.</li>
            <li>Scanne la page d'accueil et les routes probables comme `accessibilite`.</li>
          </ul>
        </aside>
      </section>

      <section className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-ivory-muted">
              Resultats
            </p>
            <h2 className="mt-2 font-display text-3xl text-ivory">
              Entreprises correspondantes
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory-muted">
              {filteredResults.length} resultat{filteredResults.length > 1 ? 's' : ''}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory-muted">
              {selectedResults.length} selectionne{selectedResults.length > 1 ? 's' : ''}
            </span>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory-muted">
              <span>Statut</span>
              <select
                value={eligibilityFilter}
                onChange={(event) => setEligibilityFilter(event.target.value as EligibilityFilter)}
                className="bg-transparent text-sm text-ivory outline-none"
              >
                <option value="tous" className="bg-ink text-ivory">
                  Tous
                </option>
                <option value="soumis_probable" className="bg-ink text-ivory">
                  {getEligibilityLabel('soumis_probable')}
                </option>
                <option value="hors_perimetre_probable" className="bg-ink text-ivory">
                  {getEligibilityLabel('hors_perimetre_probable')}
                </option>
                <option value="incertain" className="bg-ink text-ivory">
                  {getEligibilityLabel('incertain')}
                </option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory-muted">
              <span>Accessibilite</span>
              <select
                value={accessibilityFilter}
                onChange={(event) =>
                  setAccessibilityFilter(event.target.value as AccessibilityFilter)
                }
                className="bg-transparent text-sm text-ivory outline-none"
              >
                <option value="tous" className="bg-ink text-ivory">
                  Tous
                </option>
                <option value="elements_detectes" className="bg-ink text-ivory">
                  {getScanStatusLabel('elements_detectes')}
                </option>
                <option value="elements_partiels" className="bg-ink text-ivory">
                  {getScanStatusLabel('elements_partiels')}
                </option>
                <option
                  value="conformite_non_demontree"
                  className="bg-ink text-ivory"
                >
                  {getScanStatusLabel('conformite_non_demontree')}
                </option>
                <option
                  value="a_verifier_manuellement"
                  className="bg-ink text-ivory"
                >
                  {getScanStatusLabel('a_verifier_manuellement')}
                </option>
                <option value="sans_analyse" className="bg-ink text-ivory">
                  Sans analyse
                </option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              disabled={filteredResults.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tout selectionner
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={selectedResults.length === 0 || exporting}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={selectedResults.length === 0 || exporting}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exporter Excel
            </button>
            <button
              type="button"
              onClick={handleEnrichWebsites}
              disabled={
                enriching ||
                results.length === 0 ||
                results.every((company) => company.websiteUrl && company.email)
                || exporting
              }
              className="inline-flex h-10 items-center gap-2 rounded-full border border-moss/40 bg-moss/10 px-4 text-sm text-moss transition hover:border-moss hover:bg-moss hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enriching ? <Spinner className="text-moss" /> : <Globe className="h-4 w-4" />}
              {enriching && enrichProgress
                ? `Completer les sites (${enrichProgress.done}/${enrichProgress.total})`
                : selectedResults.length > 0
                  ? 'Completer les sites selectionnes'
                  : 'Completer les sites'}
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {filteredResults.map((company) => (
            <article
              key={company.siren}
              className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel"
            >
              <label className="mb-4 inline-flex items-center gap-3 text-sm text-ivory-muted">
                <input
                  type="checkbox"
                  checked={selectedSirens.includes(company.siren)}
                  onChange={() => toggleCompanySelection(company.siren)}
                  className="h-4 w-4 rounded border border-white/20 bg-ink-soft accent-copper"
                />
                Selectionner pour export
              </label>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-2xl text-ivory">{company.nom}</h3>
                    <StatusBadge status={company.eligibility} type="eligibility" />
                    {company.latestScanStatus ? (
                      <StatusBadge status={company.latestScanStatus} type="scan" />
                    ) : null}
                  </div>
                  <p className="text-sm text-ivory-muted">
                    {company.adresse ?? 'Adresse non disponible'}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    <span>SIREN {company.siren}</span>
                    <span>{company.activite ?? 'NAF inconnu'}</span>
                    <span>{company.categorieEntreprise ?? 'Categorie inconnue'}</span>
                    <span>{getEffectifLabel(company.trancheEffectif)}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-ivory-muted">
                    <span className="inline-flex items-center gap-2">
                      <Globe className="h-4 w-4 text-copper-soft" />
                      {company.websiteUrl ? (
                        <a
                          href={company.websiteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-copper-soft transition hover:text-copper"
                        >
                          {company.websiteUrl.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        <span>Site non trouve</span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Mail className="h-4 w-4 text-copper-soft" />
                      {company.email ? (
                        <a
                          href={`mailto:${company.email}`}
                          className="break-all text-copper-soft transition hover:text-copper"
                        >
                          {company.email}
                        </a>
                      ) : (
                        <span>Email non trouve</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                  <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                      Chiffre d'affaires
                    </p>
                    <p className="mt-2 text-lg text-ivory">
                      {formatCurrency(company.chiffreAffaires)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                      Ville
                    </p>
                    <p className="mt-2 text-lg text-ivory">
                      {company.ville ?? 'Non disponible'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                      Effectif
                    </p>
                    <p className="mt-2 text-lg text-ivory">
                      {getEffectifLabel(company.trancheEffectif)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                      Annee refonte estimee
                    </p>
                    <p className="mt-2 text-lg text-ivory">
                      {company.websiteRedesignYear ?? 'Non disponible'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <Link
                  to={`/entreprise/${company.siren}`}
                  className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                >
                  Ouvrir la fiche
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </article>
          ))}

          {!loading && filteredResults.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-ivory-muted">
              {results.length === 0
                ? "Aucun resultat avec ces filtres. Essaie un autre code NAF, une autre ville, un autre departement, ou retire certaines bornes."
                : "Aucun resultat ne correspond aux filtres selectionnes. Essaie un autre statut ou un autre filtre accessibilite."}
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

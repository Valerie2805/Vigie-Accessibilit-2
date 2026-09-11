import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, Globe, Mail, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { StatusBadge } from '@/components/StatusBadge';
import {
  exportCompaniesToCsv,
  exportCompaniesToExcel,
} from '@/utils/export-companies';
import {
  mergeRecentCompanies,
  readRecentCompaniesFromBrowser,
  saveRecentCompaniesToBrowser,
} from '@/utils/local-company-history';
import type { Company, EligibilityStatus, Scan, ScanStatus } from '@/types';
import { listRecentCompanies, listScans, resolveWebsite } from '@/utils/api';
import {
  formatCurrency,
  formatDate,
  getEligibilityLabel,
  getScanStatusLabel,
} from '@/utils/format';

type ScanFilter = 'tous' | ScanStatus;
type CompanyAccessibilityFilter = 'tous' | 'sans_analyse' | ScanStatus;
type CompanyEligibilityFilter = 'tous' | EligibilityStatus;

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function HistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanySirens, setSelectedCompanySirens] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [scanFilter, setScanFilter] = useState<ScanFilter>('tous');
  const [companyAccessibilityFilter, setCompanyAccessibilityFilter] =
    useState<CompanyAccessibilityFilter>('tous');
  const [companyEligibilityFilter, setCompanyEligibilityFilter] =
    useState<CompanyEligibilityFilter>('tous');

  const latestScanBySiren = useMemo(() => {
    const entries = scans
      .slice()
      .sort(
        (a, b) =>
          new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime(),
      )
      .map((scan) => [scan.siren, scan] as const);

    return new Map(entries);
  }, [scans]);

  const filteredScans = useMemo(() => {
    const normalizedQuery = normalizeText(historyQuery);

    return scans.filter((scan) => {
      const matchesFilter =
        scanFilter === 'tous' || scan.status === scanFilter;

      const haystack = normalizeText(
        `${scan.companyName} ${scan.siren} ${scan.websiteUrl} ${scan.notes.join(' ')} ${scan.evidences
          .map((evidence) => `${evidence.label} ${evidence.excerpt ?? ''}`)
          .join(' ')}`,
      );

      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [historyQuery, scanFilter, scans]);

  const filteredCompanies = useMemo(() => {
    const normalizedQuery = normalizeText(historyQuery);

    return companies.filter((company) => {
      const latestScan = latestScanBySiren.get(company.siren);
      const matchesEligibilityFilter =
        companyEligibilityFilter === 'tous' ||
        company.eligibility === companyEligibilityFilter;
      const matchesAccessibilityFilter =
        companyAccessibilityFilter === 'tous' ||
        (companyAccessibilityFilter === 'sans_analyse'
          ? !latestScan
          : latestScan?.status === companyAccessibilityFilter);

      const haystack = normalizeText(
        `${company.nom} ${company.siren} ${company.activite ?? ''} ${company.ville ?? ''} ${company.adresse ?? ''} ${company.websiteUrl ?? ''} ${company.email ?? ''}`,
      );

      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      return matchesEligibilityFilter && matchesAccessibilityFilter && matchesQuery;
    });
  }, [
    companies,
    companyAccessibilityFilter,
    companyEligibilityFilter,
    historyQuery,
    latestScanBySiren,
  ]);

  const selectedCompanies = useMemo(
    () =>
      filteredCompanies.filter((company) =>
        selectedCompanySirens.includes(company.siren),
      ),
    [filteredCompanies, selectedCompanySirens],
  );

  useEffect(() => {
    async function loadHistory() {
      try {
        const [scansResponse, companiesResponse] = await Promise.all([
          listScans(),
          listRecentCompanies(200),
        ]);
        const browserCompanies = readRecentCompaniesFromBrowser();
        setScans(scansResponse.scans);
        setCompanies(mergeRecentCompanies(companiesResponse.companies, browserCompanies));
        setSelectedCompanySirens([]);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  async function ensureExportDataForCompanies(targetCompanies: Company[]) {
    const companiesToComplete = targetCompanies.filter(
      (company) => !company.websiteUrl || !company.email,
    );
    if (companiesToComplete.length === 0) {
      return targetCompanies;
    }

    const updatedBySiren = new Map<string, Company>();

    for (const company of companiesToComplete) {
      const response = await resolveWebsite(company.siren, company.websiteUrl ?? undefined);
      const updatedCompany = {
        ...company,
        websiteUrl: response.company.websiteUrl,
        websiteSource: response.company.websiteSource,
        websiteConfidence: response.company.websiteConfidence,
        email: response.company.email,
        latestScanStatus: response.company.latestScanStatus ?? company.latestScanStatus ?? null,
        latestScannedAt: response.company.latestScannedAt ?? company.latestScannedAt ?? null,
      };

      updatedBySiren.set(company.siren, updatedCompany);

      setCompanies((current) =>
        current.map((item) =>
          item.siren === company.siren ? updatedCompany : item,
        ),
      );
      saveRecentCompaniesToBrowser([updatedCompany]);
    }

    return targetCompanies.map(
      (company) => updatedBySiren.get(company.siren) ?? company,
    );
  }

  function toggleCompanySelection(siren: string) {
    setSelectedCompanySirens((current) =>
      current.includes(siren)
        ? current.filter((item) => item !== siren)
        : [...current, siren],
    );
  }

  function handleSelectAllFilteredCompanies() {
    const filteredSirens = filteredCompanies.map((company) => company.siren);
    const allFilteredSelected =
      filteredSirens.length > 0 &&
      filteredSirens.every((siren) => selectedCompanySirens.includes(siren));

    setSelectedCompanySirens((current) => {
      if (allFilteredSelected) {
        return current.filter((siren) => !filteredSirens.includes(siren));
      }

      return Array.from(new Set([...current, ...filteredSirens]));
    });
  }

  async function handleExportCsv() {
    if (selectedCompanies.length === 0 || exporting) return;
    setExporting(true);

    try {
      const enriched = await ensureExportDataForCompanies(selectedCompanies);
      exportCompaniesToCsv(enriched);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportExcel() {
    if (selectedCompanies.length === 0 || exporting) return;
    setExporting(true);

    try {
      const enriched = await ensureExportDataForCompanies(selectedCompanies);
      exportCompaniesToExcel(enriched);
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell
      eyebrow="Historique local"
      title="Retrouve les derniers scans executes et compare leur niveau de preuve."
      description="L'historique conserve les analyses recentes dans le workspace local. Il te permet de revenir sur un dossier, de comparer les scores et de relancer un scan si besoin."
    >
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
              Dernieres executions
            </p>
            <h2 className="mt-2 font-display text-3xl text-ivory">
              Historique des analyses
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
              {filteredScans.length} analyse{filteredScans.length > 1 ? 's' : ''}
            </span>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
              <span>Accessibilite</span>
              <select
                value={scanFilter}
                onChange={(event) => setScanFilter(event.target.value as ScanFilter)}
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
              </select>
            </label>
          </div>
        </div>

        <label className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-soft px-4 py-3 text-sm text-ivory-muted">
          <Search className="h-4 w-4 text-copper-soft" />
          <input
            value={historyQuery}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder="Rechercher dans l'historique : banque, assurance, SIREN..."
            className="w-full bg-transparent text-ivory outline-none placeholder:text-ivory-muted"
          />
        </label>

        <div className="space-y-4">
          {filteredScans.map((scan) => (
            <article
              key={scan.id}
              className="rounded-[24px] border border-white/10 bg-ink-soft p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-2xl text-ivory">{scan.companyName}</h3>
                    <StatusBadge status={scan.status} type="scan" />
                    <StatusBadge status={scan.eligibility} type="eligibility" />
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-ivory-muted">
                    <span className="inline-flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />
                      {formatDate(scan.scannedAt)}
                    </span>
                    <span>Score {scan.score}</span>
                    <span>{scan.evidences.length} preuve(s)</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link
                    to={`/analyse/${scan.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                  >
                    Ouvrir l'analyse
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/entreprise/${scan.siren}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
                  >
                    Reouvrir la fiche
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {!loading && filteredScans.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/15 bg-ink-soft p-8 text-center text-sm text-ivory-muted">
              {scans.length === 0
                ? "Aucune analyse n'a encore ete enregistree dans ce workspace."
                : "Aucune analyse ne correspond au filtre selectionne."}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-moss">
              Memoire des recherches
            </p>
            <h2 className="mt-2 font-display text-3xl text-ivory">
              Entreprises recemment vues
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
              {filteredCompanies.length} entreprise{filteredCompanies.length > 1 ? 's' : ''}
            </span>
            <span className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
              {selectedCompanies.length} selectionne{selectedCompanies.length > 1 ? 's' : ''}
            </span>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
              <span>Statut</span>
              <select
                value={companyEligibilityFilter}
                onChange={(event) =>
                  setCompanyEligibilityFilter(
                    event.target.value as CompanyEligibilityFilter,
                  )
                }
                className="bg-transparent text-sm text-ivory outline-none"
              >
                <option value="tous" className="bg-ink text-ivory">
                  Toutes
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
            <button
              type="button"
              onClick={handleSelectAllFilteredCompanies}
              disabled={filteredCompanies.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-ink-soft px-4 text-sm text-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Tout selectionner
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={selectedCompanies.length === 0 || exporting}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={selectedCompanies.length === 0 || exporting}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Exporter Excel
            </button>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory-muted">
              <span>Accessibilite</span>
              <select
                value={companyAccessibilityFilter}
                onChange={(event) =>
                  setCompanyAccessibilityFilter(
                    event.target.value as CompanyAccessibilityFilter,
                  )
                }
                className="bg-transparent text-sm text-ivory outline-none"
              >
                <option value="tous" className="bg-ink text-ivory">
                  Toutes
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
          </div>
        </div>

        <div className="space-y-4">
          {filteredCompanies.map((company) => {
            const latestScan = latestScanBySiren.get(company.siren);

            return (
              <article
                key={company.siren}
                className="rounded-[24px] border border-white/10 bg-ink-soft p-5"
              >
                <label className="mb-4 inline-flex items-center gap-3 text-sm text-ivory-muted">
                  <input
                    type="checkbox"
                    checked={selectedCompanySirens.includes(company.siren)}
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
                      {latestScan ? (
                        <StatusBadge status={latestScan.status} type="scan" />
                      ) : null}
                    </div>
                    <p className="text-sm text-ivory-muted">
                      {company.adresse ?? 'Adresse non disponible'}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.18em] text-ivory-muted">
                      <span>SIREN {company.siren}</span>
                      <span>{company.activite ?? 'NAF inconnu'}</span>
                      <span>{formatCurrency(company.chiffreAffaires)}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-ivory-muted">
                      {latestScan ? (
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-copper-soft" />
                          Analyse : {formatDate(latestScan.scannedAt)}
                        </span>
                      ) : (
                        <span>Aucune analyse enregistree</span>
                      )}
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

                  <div className="flex gap-3">
                    <Link
                      to={`/entreprise/${company.siren}`}
                      className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                    >
                      Ouvrir la fiche
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          {!loading && filteredCompanies.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-white/15 bg-ink-soft p-8 text-center text-sm text-ivory-muted">
              {companies.length === 0
                ? "Aucune entreprise n'a encore ete memorisee via la recherche."
                : "Aucune entreprise ne correspond a cette recherche ou a ce filtre d'accessibilite."}
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

import { useEffect, useState } from 'react';
import { ArrowRight, Globe, Mail, Sparkles } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { MetricCard } from '@/components/MetricCard';
import { Spinner } from '@/components/Spinner';
import { StatusBadge } from '@/components/StatusBadge';
import type { Company, WebsiteResolution } from '@/types';
import { createAxeScan, getCompany, resolveWebsite } from '@/utils/api';
import { formatCurrency, formatDate, getEligibilityLabel } from '@/utils/format';

export default function CompanyPage() {
  const { siren = '' } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [resolution, setResolution] = useState<WebsiteResolution | null>(null);
  const [manualWebsite, setManualWebsite] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibilityLabel = company?.eligibility
    ? getEligibilityLabel(company.eligibility)
    : 'Perimetre inconnu';
  const resolutionNotes = Array.isArray(resolution?.notes) && resolution?.notes.length
    ? resolution.notes
    : ["L'application attend une resolution automatique ou une URL manuelle."];
  const resolvedWebsiteHref = (() => {
    const url = resolution?.websiteUrl;
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
  })();

  useEffect(() => {
    async function loadCompany() {
      try {
        const response = await getCompany(siren);
        setCompany(response.company);
        setManualWebsite(response.company.websiteUrl ?? '');
        setResolution({
          websiteUrl: response.company.websiteUrl,
          source: response.company.websiteSource,
          confidence: response.company.websiteConfidence,
          websiteRedesignYear: response.company.websiteRedesignYear,
          notes: [],
        });
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Impossible de charger l'entreprise.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadCompany();
  }, [siren]);

  async function handleResolve() {
    if (!company) {
      return;
    }

    setResolving(true);
    setError(null);

    try {
      const response = await resolveWebsite(company.siren, manualWebsite);
      setCompany(response.company);
      setResolution(response.resolution);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossible de resoudre le site officiel.",
      );
    } finally {
      setResolving(false);
    }
  }

  async function handleScan() {
    if (!company) {
      return;
    }

    setLaunching(true);
    setError(null);

    try {
      const response = await createAxeScan(
        company.siren,
        manualWebsite || resolution?.websiteUrl || '',
      );
      navigate(`/analyse/${response.scan.id}`, {
        state: {
          scan: response.scan,
        },
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossible de lancer l'analyse.",
      );
    } finally {
      setLaunching(false);
    }
  }

  return (
    <AppShell
      eyebrow="Fiche entreprise"
      title="Prepare l'analyse et confirme le bon site avant de scanner."
      description="Cette etape sert a verifier le contexte de l'entreprise, son niveau d'exposition probable et l'URL qui sera analysee. Tu peux laisser la resolution automatique agir ou imposer le site manuellement."
    >
      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-ivory-muted">
          Chargement de la fiche entreprise...
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-[28px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {company ? (
        <>
          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="SIREN"
              value={company.siren}
              hint={company.activite ?? 'Activite non disponible'}
              icon={<Sparkles className="h-4 w-4" />}
            />
            <MetricCard
              label="Chiffre d'affaires"
              value={formatCurrency(company.chiffreAffaires)}
              hint={company.categorieEntreprise ?? 'Categorie inconnue'}
              icon={<Sparkles className="h-4 w-4" />}
            />
            <MetricCard
              label="Ville"
              value={company.ville ?? 'Non disponible'}
              hint={company.codePostal ?? 'Code postal indisponible'}
              icon={<Sparkles className="h-4 w-4" />}
            />
            <MetricCard
              label="Perimetre"
              value={eligibilityLabel}
              hint="Estimation basee sur categorie, activite et CA"
              icon={<Sparkles className="h-4 w-4" />}
            />
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <article className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-3xl text-ivory">{company.nom}</h2>
                <StatusBadge status={company.eligibility} type="eligibility" />
              </div>
              <p className="mt-3 text-sm leading-7 text-ivory-muted">
                {company.adresse ?? 'Adresse non disponible'}
              </p>

              <div className="mt-8 rounded-[24px] border border-white/10 bg-ink-soft p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-copper-soft">
                  Site a analyser
                </p>

                <label className="mt-4 block">
                  <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    URL manuelle optionnelle
                  </span>
                  <input
                    value={manualWebsite}
                    onChange={(event) => setManualWebsite(event.target.value)}
                    placeholder="https://www.exemple.fr"
                    className="h-14 w-full rounded-2xl border border-white/10 bg-ink px-4 text-sm text-ivory outline-none transition focus:border-copper/50"
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleResolve}
                    disabled={resolving}
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-5 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:opacity-50"
                  >
                    {resolving ? (
                      <Spinner />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    Resoudre le site
                  </button>

                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={launching}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-moss px-5 text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
                  >
                    {launching ? (
                      <Spinner />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Lancer le scan accessibilite
                  </button>
                </div>
              </div>
            </article>

            <article className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
              <p className="text-xs uppercase tracking-[0.24em] text-moss">
                Resolution actuelle
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    URL detectee
                  </p>
                  {resolvedWebsiteHref ? (
                    <a
                      href={resolvedWebsiteHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block break-all text-base text-copper-soft transition hover:text-copper"
                    >
                      {resolution?.websiteUrl}
                    </a>
                  ) : (
                    <p className="mt-2 break-all text-base text-ivory">
                      Aucune URL resolue pour le moment
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    Email detecte
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-base text-ivory">
                    <Mail className="h-4 w-4 text-copper-soft" />
                    {company.email ? (
                      <a
                        href={`mailto:${company.email}`}
                        className="break-all text-copper-soft transition hover:text-copper"
                      >
                        {company.email}
                      </a>
                    ) : (
                      <span className="text-ivory">Email non trouve</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    Source
                  </p>
                  <p className="mt-2 text-base text-ivory">
                    {resolution?.source ?? 'inconnue'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    Derniere exportation
                  </p>
                  <p className="mt-2 text-base text-ivory">
                    {company.lastExportedAt ? formatDate(company.lastExportedAt) : 'Jamais exporte'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-ink-soft p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                    Notes
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-ivory-muted">
                    {resolutionNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <Link
                to="/"
                className="mt-5 inline-flex items-center gap-2 text-sm text-copper-soft transition hover:text-copper"
              >
                Retour a la recherche
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}
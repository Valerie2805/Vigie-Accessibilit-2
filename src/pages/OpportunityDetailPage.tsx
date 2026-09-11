import { useEffect, useState } from 'react';
import { Download, Globe, Mail, Radar, ScrollText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ConfidenceBadge } from '@/components/ConfidenceBadge';
import { MetricCard } from '@/components/MetricCard';
import { OfferRecommendationCard } from '@/components/OfferRecommendationCard';
import { OpportunityScoreBadge } from '@/components/OpportunityScoreBadge';
import { OpportunityStatusSelector } from '@/components/OpportunityStatusSelector';
import { OutreachComposer } from '@/components/OutreachComposer';
import { ProblemsSummaryCard } from '@/components/ProblemsSummaryCard';
import { ScoreExplanationPanel } from '@/components/ScoreExplanationPanel';
import { UrgencyBadge } from '@/components/UrgencyBadge';
import { WhyNowCard } from '@/components/WhyNowCard';
import type { Opportunity, OpportunityStatus } from '@/types';
import { exportOpportunitiesToCsv, exportOpportunitiesToXls } from '@/utils/export-opportunities';
import {
  getOpportunity,
  regenerateOpportunityOutreach,
  recomputeOpportunity,
  registerOpportunityExport,
  updateOpportunityStatus,
} from '@/utils/api';
import { formatDate, getOpportunityOfferLabel } from '@/utils/format';

export default function OpportunityDetailPage() {
  const { opportunityId = '' } = useParams();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    async function loadOpportunity() {
      try {
        const response = await getOpportunity(opportunityId);
        setOpportunity(response.opportunity);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Impossible de charger l'opportunite.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadOpportunity();
  }, [opportunityId]);

  async function handleStatusChange(status: OpportunityStatus) {
    if (!opportunity) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await updateOpportunityStatus(opportunity.id, status);
      setOpportunity(response.opportunity);
      setInfo('Statut mis a jour.');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Impossible de changer le statut.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRecompute() {
    if (!opportunity) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await recomputeOpportunity(opportunity.id);
      setOpportunity(response.opportunity);
      setInfo('Opportunite recalculee.');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Impossible de recalculer.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerateOutreach() {
    if (!opportunity) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await regenerateOpportunityOutreach(opportunity.id);
      setOpportunity(response.opportunity);
      setInfo('Message regenere.');
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Impossible de regenerer.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(value: string, successMessage: string) {
    await navigator.clipboard.writeText(value);
    setInfo(successMessage);
  }

  async function handleExport(format: 'csv' | 'xls') {
    if (!opportunity) {
      return;
    }

    try {
      const response = await registerOpportunityExport([opportunity.id], format);
      const updated = response.opportunities[0];
      if (updated) {
        setOpportunity(updated);
        if (format === 'csv') {
          exportOpportunitiesToCsv([updated], `${updated.id}.csv`);
        } else {
          exportOpportunitiesToXls([updated], `${updated.id}.xls`);
        }
      }
      setInfo(`Export ${format.toUpperCase()} genere.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Impossible d'enregistrer la date d'export.",
      );
    }
  }

  return (
    <AppShell
      eyebrow="Fiche opportunite"
      title="Lis pourquoi ce lead merite un contact et quel message envoyer."
      description="La fiche reste volontairement prudente: elle affiche des signaux detectes, une exposition reglementaire estimee et des points a confirmer par audit humain."
    >
      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-ivory-muted">
          Chargement de l'opportunite...
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-[28px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {info ? (
        <div className="mb-6 rounded-[28px] border border-moss/20 bg-moss/10 p-4 text-sm text-moss">
          {info}
        </div>
      ) : null}

      {opportunity ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl text-ivory">{opportunity.site.name}</h2>
            <OpportunityScoreBadge
              score={opportunity.scores.leadScore}
              label={opportunity.scores.leadLabel}
            />
            <UrgencyBadge urgency={opportunity.scores.regulatoryUrgency} />
            <ConfidenceBadge confidence={opportunity.scan.confidence} />
            <OpportunityStatusSelector
              value={opportunity.status}
              onChange={handleStatusChange}
              disabled={saving}
            />
          </div>

          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="Lead score"
              value={`${opportunity.scores.leadScore}`}
              hint="Priorite commerciale estimee"
              icon={<Radar className="h-4 w-4" />}
            />
            <MetricCard
              label="Offre"
              value={getOpportunityOfferLabel(opportunity.recommendedOffer.primary)}
              hint="Offre la plus pertinente"
              icon={<Mail className="h-4 w-4" />}
            />
            <MetricCard
              label="Pages scannees"
              value={`${opportunity.scan.pagesScanned}`}
              hint="Couverture utile pour le score"
              icon={<Globe className="h-4 w-4" />}
            />
            <MetricCard
              label="Derniere mise a jour"
              value={formatDate(opportunity.updatedAt)}
              hint="Recalcul ou changement de statut"
              icon={<ScrollText className="h-4 w-4" />}
            />
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="space-y-6">
              <ProblemsSummaryCard opportunity={opportunity} />
              <ScoreExplanationPanel opportunity={opportunity} />
            </div>

            <div className="space-y-6">
              <OfferRecommendationCard opportunity={opportunity} />
              <WhyNowCard opportunity={opportunity} />
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
            <OutreachComposer
              opportunity={opportunity}
              onCopy={handleCopy}
              onRegenerate={handleRegenerateOutreach}
              loading={saving}
            />

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">Resume</p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-ivory-muted">
                  <li>Pays: {opportunity.site.country}</li>
                  <li>Secteur: {opportunity.site.sector ?? 'A confirmer'}</li>
                  <li>Type de site: {opportunity.site.siteType}</li>
                  <li>Scan source: {opportunity.scan.scannedAt ? formatDate(opportunity.scan.scannedAt) : 'Non disponible'}</li>
                  <li>Domaine: {opportunity.site.domain ?? 'Non disponible'}</li>
                </ul>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleRecompute}
                    disabled={saving}
                    className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Recalculer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Exporter CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('xls')}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Exporter XLS
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-moss">
                  Points a confirmer par audit humain
                </p>
                <p className="mt-4 text-sm leading-7 text-ivory-muted">
                  La priorisation, l urgence et la recommandation d offre s appuient sur des
                  signaux detectes automatiquement. Ils servent a accelerer la prospection, pas a
                  formuler un avis juridique.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/opportunites"
                    className="rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                  >
                    Retour au dashboard
                  </Link>
                  {opportunity.scanId ? (
                    <Link
                      to={`/analyse/${opportunity.scanId}`}
                      className="rounded-full border border-white/10 bg-ink-soft px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
                    >
                      Voir le scan source
                    </Link>
                  ) : null}
                </div>
              </div>
            </aside>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

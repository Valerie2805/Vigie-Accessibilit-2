import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileSearch, Globe, Radar, ScrollText } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { EvidenceList } from '@/components/EvidenceList';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';
import type { AxeImpact, OpportunitySignalCategory, Scan } from '@/types';
import { exportAnalysisToPdf } from '@/utils/export-analysis-pdf';
import { getScan } from '@/utils/api';
import { formatDate } from '@/utils/format';

type AnalysisLocationState = {
  scan?: Scan;
};

const axeRuleTranslations: Record<string, { title: string; description: string }> = {
  'color-contrast': {
    title: 'Contraste insuffisant',
    description:
      "Des contrastes de couleurs semblent insuffisants entre certains textes et leur arrière-plan, ce qui peut nuire à la lecture.",
  },
  'image-alt': {
    title: 'Image sans alternative textuelle',
    description:
      "Certaines images importantes semblent dépourvues de texte alternatif exploitable pour les technologies d'assistance.",
  },
  'input-image-alt': {
    title: 'Bouton image sans alternative',
    description:
      "Certains boutons illustrés ne semblent pas fournir de libellé textuel suffisant pour être compris correctement.",
  },
  label: {
    title: 'Champ sans libellé explicite',
    description:
      'Certains champs de formulaire semblent manquer de libellé clair, ce qui peut compliquer leur utilisation.',
  },
  'button-name': {
    title: 'Bouton sans nom explicite',
    description:
      "Certains boutons semblent ne pas exposer d'intitulé suffisamment clair pour les technologies d'assistance.",
  },
  'link-name': {
    title: 'Lien sans intitulé explicite',
    description:
      'Certains liens semblent manquer de texte suffisamment descriptif pour indiquer clairement leur destination.',
  },
  'document-title': {
    title: 'Titre de page insuffisant',
    description:
      "La page semble ne pas exposer un titre suffisamment clair, ce qui peut gêner la compréhension du contexte.",
  },
  'html-has-lang': {
    title: 'Langue de page non déclarée',
    description:
      "La langue principale de la page semble absente ou mal déclarée, ce qui peut affecter la lecture par les aides techniques.",
  },
  bypass: {
    title: 'Mécanisme de contournement absent',
    description:
      "Un moyen de contourner des blocs répétitifs, comme un lien d'évitement, semble manquer sur la page analysée.",
  },
  'heading-order': {
    title: 'Ordre des titres à vérifier',
    description:
      'La hiérarchie des titres semble perfectible, ce qui peut rendre la structure de page moins lisible.',
  },
  'aria-dialog-name': {
    title: 'Boîte de dialogue sans intitulé',
    description:
      "Certaines boîtes de dialogue semblent ne pas exposer de nom clair pour les technologies d'assistance.",
  },
  'select-name': {
    title: 'Liste de sélection sans nom explicite',
    description:
      'Certaines listes de sélection semblent ne pas fournir de libellé suffisamment clair.',
  },
  'duplicate-id-aria': {
    title: 'Identifiants ARIA dupliqués',
    description:
      "Des identifiants utilisés par des attributs ARIA semblent dupliqués, ce qui peut perturber l'interprétation de la page.",
  },
  'nested-interactive': {
    title: 'Éléments interactifs imbriqués',
    description:
      'Des composants interactifs semblent imbriqués les uns dans les autres, ce qui peut rendre les interactions ambiguës.',
  },
  'frame-title': {
    title: 'Cadre sans titre explicite',
    description:
      "Certains cadres ou contenus embarqués semblent ne pas exposer de titre suffisamment clair.",
  },
};

const legacyEnglishAxePhrases: Array<[string, string]> = [
  ['Images must have alternative text', 'Images sans alternative textuelle'],
  ['Image buttons must have alternative text', 'Boutons image sans alternative textuelle'],
  ['Links must have discernible text', 'Liens sans intitulé explicite'],
  ['Elements must meet minimum color contrast ratio thresholds', 'Contraste insuffisant'],
  ['Buttons must have discernible text', 'Boutons sans nom explicite'],
  ['Form elements must have labels', 'Champs sans libellé explicite'],
  ['Frames must have an accessible name', 'Cadres sans titre explicite'],
  ['Documents must have <title> element to aid in navigation', 'Titre de page insuffisant'],
  ['<html> element must have a lang attribute', 'Langue de page non déclarée'],
];

function normalizeLegacyAxeText(value: string) {
  return legacyEnglishAxePhrases.reduce(
    (current, [english, french]) => current.split(english).join(french),
    value,
  );
}

function getCategoryLabel(category: OpportunitySignalCategory) {
  switch (category) {
    case 'images_sans_alternative':
      return 'Images sans alternative';
    case 'structure_semantique':
      return 'Structure sémantique';
    case 'navigation_clavier':
      return 'Navigation clavier';
    case 'menus_modales_popups':
      return 'Menus, modales, popups';
    case 'composants_interactifs':
      return 'Composants interactifs';
    case 'documents_pdf':
      return 'Documents PDF';
    case 'erreurs_recurrentes_globales':
      return 'Erreurs récurrentes globales';
    default:
      return category.replace(/_/g, ' ');
  }
}

function getImpactLabel(impact: AxeImpact) {
  switch (impact) {
    case 'critical':
      return 'Priorité critique';
    case 'serious':
      return 'Important';
    case 'moderate':
      return 'À traiter';
    case 'minor':
      return 'Secondaire';
    default:
      return 'À qualifier';
  }
}

function getRuleCategory(ruleId: string): OpportunitySignalCategory {
  const lowerRuleId = ruleId.toLowerCase();

  if (lowerRuleId.includes('color-contrast')) {
    return 'contraste';
  }

  if (/image-alt|input-image-alt|area-alt|object-alt|svg-img-alt|role-img-alt/.test(lowerRuleId)) {
    return 'images_sans_alternative';
  }

  if (/label|form-field|autocomplete|select-name|input-button-name|button-name/.test(lowerRuleId)) {
    return 'formulaires';
  }

  if (/bypass|accesskeys|focus|tabindex|skip-link/.test(lowerRuleId)) {
    return 'navigation_clavier';
  }

  if (/aria-dialog-name|modal|popup|menuitem/.test(lowerRuleId)) {
    return 'menus_modales_popups';
  }

  if (/aria-|link-name|nested-interactive|duplicate-id-aria|role/.test(lowerRuleId)) {
    return 'composants_interactifs';
  }

  if (/caption|video|audio|track/.test(lowerRuleId)) {
    return 'medias';
  }

  if (/document-title|heading|html-has-lang|landmark|list|definition-list|dlitem|region/.test(lowerRuleId)) {
    return 'structure_semantique';
  }

  return 'erreurs_recurrentes_globales';
}

function getRuleTitle(ruleId: string) {
  return axeRuleTranslations[ruleId]?.title ?? "Règle d'accessibilité à vérifier";
}

function getRuleDescription(ruleId: string, impact: AxeImpact) {
  const translated = axeRuleTranslations[ruleId]?.description;
  if (translated) {
    return translated;
  }

  return `Cette règle technique signale un point à vérifier avec un niveau de gravité ${getImpactLabel(impact).toLowerCase()}.`;
}

function extractReadableText(htmlSnippet: string) {
  const plainText = htmlSnippet
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

  return plainText.length > 0 ? plainText : null;
}

function shortenText(value: string, maxLength = 80) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function extractSnippetAttribute(htmlSnippet: string, attribute: string) {
  const match = htmlSnippet.match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, 'i'));
  const value = match?.[1]?.trim();
  return value ? value : null;
}

function describeElementKind(selector: string, htmlSnippet: string) {
  const lowerSelector = selector.toLowerCase();
  const lowerSnippet = htmlSnippet.toLowerCase();

  if (
    lowerSelector.includes('input') ||
    lowerSelector.includes('select') ||
    lowerSelector.includes('textarea') ||
    lowerSelector.includes('form') ||
    lowerSnippet.includes('<input') ||
    lowerSnippet.includes('<select') ||
    lowerSnippet.includes('<textarea')
  ) {
    return 'champ de formulaire';
  }

  if (
    lowerSelector.includes('button') ||
    lowerSnippet.includes('<button') ||
    /type\s*=\s*["']?(button|submit|reset)["']?/i.test(htmlSnippet)
  ) {
    return "bouton d'action";
  }

  if (
    lowerSelector.includes('img') ||
    lowerSelector.includes('image') ||
    lowerSnippet.includes('<img') ||
    lowerSnippet.includes('<svg')
  ) {
    return 'visuel';
  }

  if (
    lowerSelector.includes('a[') ||
    lowerSelector.includes('href') ||
    lowerSelector.includes('link') ||
    lowerSnippet.includes('<a ')
  ) {
    return 'lien';
  }

  if (
    lowerSelector.includes('dialog') ||
    lowerSelector.includes('modal') ||
    lowerSelector.includes('popup') ||
    lowerSnippet.includes('dialog')
  ) {
    return 'fenêtre de dialogue';
  }

  if (lowerSelector.includes('nav') || lowerSelector.includes('menu') || lowerSnippet.includes('<nav')) {
    return 'élément de navigation';
  }

  if (
    lowerSelector.includes('iframe') ||
    lowerSelector.includes('frame') ||
    lowerSnippet.includes('<iframe') ||
    lowerSnippet.includes('<frame')
  ) {
    return 'contenu embarqué';
  }

  return 'élément';
}

function describeAffectedElement(selector: string, htmlSnippet: string, ruleId: string) {
  const readableText = extractReadableText(htmlSnippet);
  const lowerSelector = selector.toLowerCase();
  const category = getRuleCategory(ruleId);
  const lowerRuleId = ruleId.toLowerCase();
  const elementKind = describeElementKind(selector, htmlSnippet);
  const ariaLabel = extractSnippetAttribute(htmlSnippet, 'aria-label');
  const titleAttr = extractSnippetAttribute(htmlSnippet, 'title');
  const placeholder = extractSnippetAttribute(htmlSnippet, 'placeholder');

  if (lowerRuleId === 'link-name') {
    if (readableText) {
      const shortText = shortenText(readableText);
      return `Lien dont l'intitulé visible « ${shortText} » semble insuffisant ou ambigu.`;
    }

    if (lowerSelector.includes('img') || lowerSelector.includes('image')) {
      return 'Visuel cliquable sans intitulé explicite pour indiquer sa destination.';
    }

    return 'Lien cliquable sans intitulé explicite pour indiquer sa destination.';
  }

  if (/image-alt|input-image-alt|area-alt|object-alt|svg-img-alt|role-img-alt/.test(lowerRuleId)) {
    if (titleAttr) {
      return `Visuel dont le libellé disponible « ${shortenText(titleAttr)} » ne remplace pas un vrai texte alternatif.`;
    }

    if (lowerRuleId === 'input-image-alt') {
      return "Bouton illustré sans libellé textuel explicite pour être compris par les aides techniques.";
    }

    return "Visuel informatif sans texte alternatif exploitable par les aides techniques.";
  }

  if (lowerRuleId === 'button-name') {
    if (ariaLabel) {
      return `Bouton dont le libellé technique « ${shortenText(ariaLabel)} » semble insuffisant ou mal exposé.`;
    }

    return "Bouton d'action sans intitulé explicite.";
  }

  if (lowerRuleId === 'label' || lowerRuleId === 'select-name') {
    if (placeholder) {
      return `Champ de formulaire dont l'indication « ${shortenText(placeholder)} » ne remplace pas un libellé clair.`;
    }

    return 'Champ de formulaire sans libellé explicite.';
  }

  if (lowerRuleId === 'aria-dialog-name') {
    return "Fenêtre de dialogue sans intitulé explicite.";
  }

  if (lowerRuleId === 'frame-title') {
    return 'Contenu embarqué sans titre explicite.';
  }

  if (lowerRuleId === 'document-title') {
    return 'Page sans titre suffisamment explicite dans le navigateur ou les aides techniques.';
  }

  if (lowerRuleId === 'html-has-lang') {
    return 'Langue principale de la page non déclarée clairement.';
  }

  if (lowerRuleId === 'duplicate-id-aria') {
    return "Composants liés aux aides techniques avec des repères internes dupliqués, ce qui peut créer des confusions de lecture.";
  }

  if (lowerRuleId === 'nested-interactive') {
    return "Zone interactive contenant un autre élément cliquable ou activable, ce qui peut rendre l'usage confus.";
  }

  if (readableText) {
    const shortText = shortenText(readableText);
    return `Élément contenant le texte « ${shortText} ».`;
  }

  if (elementKind === "bouton d'action") {
    return "Bouton d'action concerné.";
  }

  if (elementKind === 'champ de formulaire') {
    return 'Champ de formulaire concerné.';
  }

  if (elementKind === 'visuel') {
    return 'Visuel concerné.';
  }

  if (elementKind === 'lien') {
    return 'Lien ou élément cliquable concerné.';
  }

  if (elementKind === 'élément de navigation') {
    return 'Élément de navigation concerné.';
  }

  if (elementKind === 'fenêtre de dialogue') {
    return 'Fenêtre, modale ou panneau interactif concerné.';
  }

  if (elementKind === 'contenu embarqué') {
    return 'Contenu embarqué concerné.';
  }

  if (category === 'contraste') {
    return 'Zone de texte ou élément visuel dont la lisibilité semble insuffisante.';
  }

  if (category === 'navigation_clavier') {
    return "Élément interactif dont l'usage au clavier semble à vérifier.";
  }

  if (category === 'composants_interactifs') {
    return 'Composant interactif concerné.';
  }

  return `${elementKind.charAt(0).toUpperCase()}${elementKind.slice(1)} concerné.`;
}

function normalizeRuleElement(
  element: string | { selector?: string; htmlSnippet?: string },
): { selector: string; htmlSnippet: string } {
  if (typeof element === 'string') {
    return {
      selector: element,
      htmlSnippet: '',
    };
  }

  return {
    selector: element.selector ?? '',
    htmlSnippet: element.htmlSnippet ?? '',
  };
}

export default function AnalysisPage() {
  const { scanId = '' } = useParams();
  const location = useLocation();
  const initialScan = (location.state as AnalysisLocationState | null)?.scan ?? null;
  const [scan, setScan] = useState<Scan | null>(initialScan);
  const [loading, setLoading] = useState(!initialScan);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const axeSummary = scan?.axe ?? null;
  const scanUrlHref = (() => {
    const url = axeSummary?.url ?? scan?.websiteUrl ?? '';
    if (!url) {
      return null;
    }

    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  })();
  const highImpactCount = useMemo(() => {
    if (!axeSummary) {
      return 0;
    }

    return axeSummary.violationsByImpact.critical + axeSummary.violationsByImpact.serious;
  }, [axeSummary]);

  useEffect(() => {
    async function loadScan() {
      if (initialScan) {
        setLoading(false);
        return;
      }

      try {
        const response = await getScan(scanId);
        setScan(response.scan);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Impossible de charger l'analyse.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadScan();
  }, [initialScan, scanId]);

  async function handleExportPdf() {
    if (!scan) {
      return;
    }

    setExportingPdf(true);

    try {
      exportAnalysisToPdf(scan);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Impossible d'ouvrir l'export PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <AppShell
      eyebrow="Resultat d'analyse"
      title="Visualise les preuves trouvees et le niveau de risque estime."
      description="Le score ci-dessous reste un indicateur operationnel, pas une qualification juridique. Il sert a faire gagner du temps pour les revues manuelles et les audits plus solides."
    >
      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-sm text-ivory-muted">
          Chargement de l'analyse...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[28px] border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {scan ? (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-3xl text-ivory">{scan.companyName}</h2>
            <StatusBadge status={scan.status} type="scan" />
            <StatusBadge status={scan.eligibility} type="eligibility" />
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-2 rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {exportingPdf ? 'Preparation du PDF...' : 'Exporter en PDF'}
            </button>
          </div>

          <section className="grid gap-4 xl:grid-cols-4">
            <MetricCard
              label="Score"
              value={`${scan.score}`}
              hint={
                axeSummary
                  ? 'Indicateur de priorite base sur le scan automatique de cette page'
                  : 'Score cumule des signaux detectes'
              }
              icon={<Radar className="h-4 w-4" />}
            />
            <MetricCard
              label={axeSummary ? 'Violations' : 'Evidences'}
              value={`${axeSummary ? axeSummary.totalViolations : scan.evidences.length}`}
              hint={
                axeSummary
                  ? 'Occurrences remontees automatiquement par axe-core'
                  : 'Liens et mentions publiques reperes'
              }
              icon={axeSummary ? <AlertTriangle className="h-4 w-4" /> : <FileSearch className="h-4 w-4" />}
            />
            <MetricCard
              label={axeSummary ? 'Gravite elevee' : 'URL analysee'}
              value={
                axeSummary
                  ? `${highImpactCount}`
                  : scan.websiteUrl.replace(/^https?:\/\//, '')
              }
              hint={
                axeSummary
                  ? 'Occurrences critiques ou serieuses a confirmer par audit humain'
                  : 'Site scanne pour cette analyse'
              }
              icon={axeSummary ? <AlertTriangle className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
            />
            <MetricCard
              label={axeSummary ? 'Categories' : 'Horodatage'}
              value={axeSummary ? `${axeSummary.categories.length}` : formatDate(scan.scannedAt)}
              hint={axeSummary ? 'Familles de problemes dominantes sur cette page' : 'Derniere execution'}
              icon={axeSummary ? <Globe className="h-4 w-4" /> : <ScrollText className="h-4 w-4" />}
            />
          </section>

          {axeSummary ? (
            <section className="mt-8 grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
              <article className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                  Resume Browserless + axe-core
                </p>
                {scanUrlHref ? (
                  <p className="mt-4 text-sm text-ivory-muted">
                    URL scannee:{' '}
                    <a
                      href={scanUrlHref}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-copper-soft underline underline-offset-2 transition hover:text-copper"
                    >
                      {axeSummary.url}
                    </a>
                  </p>
                ) : null}
                <p className="mt-4 text-sm leading-7 text-ivory-muted">
                  {normalizeLegacyAxeText(axeSummary.nonExpertSummary)}
                </p>

                <div className="mt-6 rounded-[24px] border border-white/10 bg-ink-soft p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-moss">
                    Signaux detectes automatiquement
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-ivory-muted">
                    {axeSummary.detectedSignals.map((signal) => (
                      <li key={signal}>{normalizeLegacyAxeText(signal)}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 rounded-[24px] border border-white/10 bg-ink-soft p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-copper-soft">
                    Points a confirmer par audit humain
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-ivory-muted">
                    {axeSummary.humanAuditPoints.map((point) => (
                      <li key={point}>{normalizeLegacyAxeText(point)}</li>
                    ))}
                  </ul>
                </div>
              </article>

              <aside className="space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                  <p className="text-xs uppercase tracking-[0.28em] text-moss">
                    Vue synthese
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-ivory-muted">
                    <p>
                      URL scannee:{' '}
                      {scanUrlHref ? (
                        <a
                          href={scanUrlHref}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-copper-soft underline underline-offset-2 transition hover:text-copper"
                        >
                          {axeSummary.url}
                        </a>
                      ) : (
                        <span className="text-ivory">{axeSummary.url}</span>
                      )}
                    </p>
                    <p>
                      Date du scan: <span className="text-ivory">{formatDate(axeSummary.scannedAt)}</span>
                    </p>
                    <p>
                      Priorité critique: <span className="text-ivory">{axeSummary.violationsByImpact.critical}</span>
                    </p>
                    <p>
                      Important: <span className="text-ivory">{axeSummary.violationsByImpact.serious}</span>
                    </p>
                    <p>
                      À traiter: <span className="text-ivory">{axeSummary.violationsByImpact.moderate}</span>
                    </p>
                    <p>
                      Secondaire: <span className="text-ivory">{axeSummary.violationsByImpact.minor}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                  <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                    Categories principales
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {axeSummary.categories.length > 0 ? (
                      axeSummary.categories.map((entry) => (
                        <span
                          key={entry.category}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.16em] text-ivory"
                        >
                          {getCategoryLabel(entry.category)} · {entry.count}
                        </span>
                      ))
                    ) : (
                        <span className="text-sm text-ivory-muted">
                        Aucune catégorie dominante sur cette page.
                      </span>
                    )}
                  </div>
                </div>
              </aside>
            </section>
          ) : null}

          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.28em] text-copper-soft">
                {axeSummary ? 'Règles principales détectées' : 'Preuves détectées'}
              </p>
              {axeSummary ? (
                <div className="space-y-4">
                  {axeSummary.topRules.length > 0 ? (
                    axeSummary.topRules.map((rule) => (
                      <article
                        key={rule.ruleId}
                        className="rounded-[24px] border border-white/10 bg-white/5 p-5 shadow-panel"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ivory">
                              {getRuleTitle(rule.ruleId)}
                            </p>
                          </div>
                          <span className="rounded-full border border-copper/30 bg-copper/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-copper-soft">
                            {getImpactLabel(rule.impact)} · {rule.occurrences}
                          </span>
                        </div>

                        <p className="mt-4 text-sm leading-7 text-ivory-muted">
                          {getRuleDescription(rule.ruleId, rule.impact)}
                        </p>

                        {rule.elements.length > 0 ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-ink-soft p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-ivory-muted">
                              Zones concernées
                            </p>
                            <ul className="mt-3 space-y-3 text-sm text-ivory-muted">
                              {rule.elements.map((rawElement, index) => {
                                const element = normalizeRuleElement(rawElement);
                                return (
                                <li
                                  key={`${rule.ruleId}-${element.selector}-${element.htmlSnippet}-${index}`}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                                >
                                  <p>{describeAffectedElement(element.selector, element.htmlSnippet, rule.ruleId)}</p>
                                  {extractReadableText(element.htmlSnippet) ? (
                                    <p className="mt-2 text-xs leading-6 text-ivory-muted">
                                      Contenu repéré : « {extractReadableText(element.htmlSnippet)} »
                                    </p>
                                  ) : null}
                                </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-ink-soft p-4 text-sm text-ivory-muted">
                            Aucun exemple concret n'a pu être extrait automatiquement pour cette règle.
                          </div>
                        )}

                        <a
                          href={rule.helpUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex text-sm text-copper-soft transition hover:text-copper"
                        >
                          Voir la regle
                        </a>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-white/15 bg-white/5 p-6 text-sm text-ivory-muted">
                      Aucune violation axe-core n'a été remontée sur cette page.
                    </div>
                  )}
                </div>
              ) : (
                <EvidenceList evidences={scan.evidences} />
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-moss">
                  Notes de scan
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-ivory-muted">
                  {scan.notes.length > 0 ? (
                    scan.notes.map((note) => <li key={note}>{note}</li>)
                  ) : (
                    <li>Aucune note supplementaire.</li>
                  )}
                </ul>
              </div>

              {axeSummary ? (
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                  <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                    Zones concernées
                  </p>
                  <div className="mt-4 space-y-3">
                    {axeSummary.highlightedElements.length > 0 ? (
                      axeSummary.highlightedElements.map((element, index) => (
                        <div
                          key={`${element.ruleId}-${element.selector}-${index}`}
                          className="rounded-2xl border border-white/10 bg-ink-soft p-4"
                        >
                          <p className="text-xs uppercase tracking-[0.18em] text-copper-soft">
                            {getRuleTitle(element.ruleId)} · {getImpactLabel(element.impact)}
                          </p>
                          <p className="mt-2 text-sm text-ivory">
                            {describeAffectedElement(
                              element.selector,
                              element.htmlSnippet,
                              element.ruleId,
                            )}
                          </p>
                          {extractReadableText(element.htmlSnippet) ? (
                            <p className="mt-2 text-xs leading-6 text-ivory-muted">
                              Contenu repéré : « {extractReadableText(element.htmlSnippet)} »
                            </p>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ivory-muted">
                        Aucun extrait d'élément n'a pu être remonté.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-panel">
                <p className="text-xs uppercase tracking-[0.28em] text-copper-soft">
                  Interpretation
                </p>
                <p className="mt-4 text-sm leading-7 text-ivory-muted">
                  {axeSummary
                    ? "Ce resultat correspond a des signaux detectes automatiquement sur une seule page via Browserless et axe-core. Il aide a prioriser une lecture commerciale, mais ne constitue ni un avis juridique ni une preuve de non-conformite."
                    : "Cette application cherche des indices visibles: page accessibilite, declaration, mention d'etat de conformite, contact et references institutionnelles. L'absence de signal ne prouve pas a elle seule une infraction."}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/historique"
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-ivory transition hover:bg-white/10"
                  >
                    Voir l'historique
                  </Link>
                  <Link
                    to={`/entreprise/${scan.siren}`}
                    className="rounded-full border border-copper/40 bg-copper/10 px-4 py-2 text-sm text-copper-soft transition hover:border-copper hover:bg-copper hover:text-ink"
                  >
                    Relancer ce dossier
                  </Link>
                </div>
              </div>
            </aside>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

import axe from 'axe-core';
import puppeteer from 'puppeteer-core';
import type {
  AxeCategorySummary,
  AxeImpact,
  AxeRuleSummary,
  AxeScanSummary,
  OpportunitySeverity,
  OpportunitySignalCategory,
} from '../types.js';

const browserlessWSEndpoint = process.env.BROWSERLESS_WS_URL?.trim() ?? '';

const impactPriority: Record<AxeImpact, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1,
  unknown: 0,
};

const axeRuleTitles: Record<string, string> = {
  'color-contrast': 'Contraste insuffisant',
  'image-alt': 'Image sans alternative textuelle',
  'input-image-alt': 'Bouton image sans alternative',
  label: 'Champ sans libellé explicite',
  'button-name': 'Bouton sans nom explicite',
  'link-name': 'Lien sans intitulé explicite',
  'document-title': 'Titre de page insuffisant',
  'html-has-lang': 'Langue de page non déclarée',
  bypass: 'Mécanisme de contournement absent',
  'heading-order': 'Ordre des titres à vérifier',
  'aria-dialog-name': 'Boîte de dialogue sans intitulé',
  'select-name': 'Liste de sélection sans nom explicite',
  'duplicate-id-aria': 'Identifiants ARIA dupliqués',
  'nested-interactive': 'Éléments interactifs imbriqués',
  'frame-title': 'Cadre sans titre explicite',
};

function ensureBrowserlessConfigured() {
  if (!browserlessWSEndpoint) {
    throw new Error("La variable d'environnement BROWSERLESS_WS_URL est manquante");
  }
}

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function normalizeImpact(impact?: string | null): AxeImpact {
  if (impact === 'critical' || impact === 'serious' || impact === 'moderate' || impact === 'minor') {
    return impact;
  }

  return 'unknown';
}

function toOpportunitySeverity(impact: AxeImpact): OpportunitySeverity {
  if (impact === 'critical' || impact === 'serious') {
    return 'high';
  }

  if (impact === 'moderate') {
    return 'medium';
  }

  return 'low';
}

function compactText(value: string, maxLength = 180) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxLength - 1)}...`;
}

function mapViolationToCategory(violation: axe.Result): OpportunitySignalCategory {
  const ruleId = violation.id.toLowerCase();
  const tags = violation.tags ?? [];

  if (ruleId.includes('color-contrast') || tags.includes('cat.color')) {
    return 'contraste';
  }

  if (
    /image-alt|input-image-alt|area-alt|object-alt|svg-img-alt|role-img-alt/.test(ruleId) ||
    tags.includes('cat.text-alternatives')
  ) {
    return 'images_sans_alternative';
  }

  if (
    /label|form-field|autocomplete|select-name|input-button-name|button-name/.test(ruleId) ||
    tags.includes('cat.forms')
  ) {
    return 'formulaires';
  }

  if (
    /bypass|accesskeys|focus|tabindex|skip-link|landmark-no-duplicate/.test(ruleId) ||
    tags.includes('cat.keyboard')
  ) {
    return 'navigation_clavier';
  }

  if (/aria-dialog-name|modal|popup|menuitem/.test(ruleId)) {
    return 'menus_modales_popups';
  }

  if (
    /aria-|button-name|link-name|nested-interactive|duplicate-id-aria|role/.test(ruleId) ||
    tags.includes('cat.aria') ||
    tags.includes('cat.name-role-value')
  ) {
    return 'composants_interactifs';
  }

  if (/caption|video|audio|track/.test(ruleId)) {
    return 'medias';
  }

  if (
    /document-title|heading|html-has-lang|landmark|list|definition-list|dlitem|region/.test(
      ruleId,
    ) ||
    tags.includes('cat.semantics') ||
    tags.includes('cat.language') ||
    tags.includes('cat.parsing')
  ) {
    return 'structure_semantique';
  }

  return 'erreurs_recurrentes_globales';
}

function buildImpactCounts(violations: axe.Result[]) {
  const counts: Record<AxeImpact, number> = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    unknown: 0,
  };

  for (const violation of violations) {
    const impact = normalizeImpact(violation.impact);
    counts[impact] += violation.nodes.length;
  }

  return counts;
}

function buildCategorySummary(violations: axe.Result[]) {
  const categories = new Map<
    OpportunitySignalCategory,
    {
      count: number;
      highestImpact: AxeImpact;
    }
  >();

  for (const violation of violations) {
    const category = mapViolationToCategory(violation);
    const existing = categories.get(category);
    const impact = normalizeImpact(violation.impact);
    const count = violation.nodes.length;

    if (!existing) {
      categories.set(category, {
        count,
        highestImpact: impact,
      });
      continue;
    }

    categories.set(category, {
      count: existing.count + count,
      highestImpact:
        impactPriority[impact] > impactPriority[existing.highestImpact]
          ? impact
          : existing.highestImpact,
    });
  }

  return Array.from(categories.entries())
    .map(
      ([category, value]): AxeCategorySummary => ({
        category,
        count: value.count,
        severity: toOpportunitySeverity(value.highestImpact),
      }),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function getCategoryLabel(category: OpportunitySignalCategory) {
  switch (category) {
    case 'images_sans_alternative':
      return 'images sans alternative';
    case 'structure_semantique':
      return 'structure sémantique';
    case 'navigation_clavier':
      return 'navigation clavier';
    case 'menus_modales_popups':
      return 'menus, modales, popups';
    case 'composants_interactifs':
      return 'composants interactifs';
    case 'documents_pdf':
      return 'documents PDF';
    case 'erreurs_recurrentes_globales':
      return 'erreurs récurrentes globales';
    default:
      return category.replace(/_/g, ' ');
  }
}

function getRuleTitle(ruleId: string, fallback?: string) {
  return axeRuleTitles[ruleId] ?? fallback ?? "règle d'accessibilité à vérifier";
}

function buildTopRules(violations: axe.Result[]) {
  return violations
    .map(
      (violation): AxeRuleSummary => ({
        ruleId: violation.id,
        impact: normalizeImpact(violation.impact),
        help: violation.help,
        description: violation.description,
        helpUrl: violation.helpUrl,
        occurrences: violation.nodes.length,
        elements: violation.nodes
          .slice(0, 3)
          .map((node) => ({
            selector: node.target.join(' '),
            htmlSnippet: compactText(node.html),
          }))
          .filter((element) => Boolean(element.selector || element.htmlSnippet)),
      }),
    )
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 5);
}

function buildHighlightedElements(violations: axe.Result[]) {
  return violations
    .slice(0, 3)
    .flatMap((violation) =>
      violation.nodes.slice(0, 2).map((node) => ({
        ruleId: violation.id,
        impact: normalizeImpact(violation.impact),
        selector: node.target.join(' '),
        htmlSnippet: compactText(node.html),
      })),
    )
    .filter((element) => Boolean(element.selector || element.htmlSnippet))
    .slice(0, 6);
}

function buildDetectedSignals(
  totalViolations: number,
  impactCounts: Record<AxeImpact, number>,
  categories: AxeCategorySummary[],
  topRules: AxeRuleSummary[],
) {
  const mainCategories = categories.slice(0, 3).map((entry) => getCategoryLabel(entry.category));
  const mainRules = topRules.slice(0, 3).map((entry) => getRuleTitle(entry.ruleId, entry.help));
  const severeCount = impactCounts.critical + impactCounts.serious;

  return [
    `${totalViolations} occurrences de signaux d'accessibilite ont ete detectees automatiquement sur cette page.`,
    severeCount > 0
      ? `${severeCount} occurrences concernent un niveau de gravite eleve ou tres eleve.`
      : "Aucune occurrence de gravite elevee n'a ete remontee par le scan automatique.",
    mainCategories.length > 0
      ? `Les categories principales semblent etre ${mainCategories.join(', ')}.`
      : 'Le scan n a pas permis d identifier de categorie dominante.',
    mainRules.length > 0
      ? `Les regles les plus presentes concernent ${mainRules.join(', ')}.`
      : 'Aucune regle prioritaire n a ete isolee.',
  ];
}

function buildHumanAuditPoints(categories: AxeCategorySummary[], totalViolations: number) {
  const points = [
    'Confirmer par audit humain l impact reel sur les parcours prioritaires du site.',
    "Verifier si les memes signaux se repetent sur d'autres pages cles, car ce MVP ne scanne qu une seule URL.",
    'Controler manuellement les composants dynamiques et les cas d usage metier que le scan automatique ne couvre pas completement.',
  ];

  if (totalViolations === 0) {
    points.unshift(
      "L absence de violation remontee automatiquement ne constitue pas une preuve de conformite et doit etre verifiee manuellement.",
    );
  } else if (categories.some((entry) => entry.category === 'formulaires')) {
    points.unshift(
      'Verifier manuellement les formulaires, messages d erreur et parcours de conversion les plus sensibles.',
    );
  }

  return points.slice(0, 4);
}

function buildNonExpertSummary(
  url: string,
  totalViolations: number,
  impactCounts: Record<AxeImpact, number>,
  categories: AxeCategorySummary[],
) {
  if (totalViolations === 0) {
    return `Aucun signal majeur n a ete remonte automatiquement sur ${url}, mais ce resultat reste a confirmer par un audit humain cible.`;
  }

  const mainCategory = categories[0]?.category.replace(/_/g, ' ') ?? 'plusieurs zones du site';
  const severeCount = impactCounts.critical + impactCounts.serious;

  if (severeCount > 0) {
    return `${totalViolations} occurrences de signaux ont ete detectees automatiquement sur ${url}, dont ${severeCount} a gravite elevee. Les points les plus visibles touchent surtout ${mainCategory} et doivent etre confirmes par audit humain.`;
  }

  return `${totalViolations} occurrences de signaux ont ete detectees automatiquement sur ${url}. Les points les plus visibles concernent ${mainCategory} et meritent une verification humaine avant toute conclusion.`;
}

export async function scanWebsiteWithAxe(targetUrl: string): Promise<AxeScanSummary> {
  ensureBrowserlessConfigured();

  const url = normalizeUrl(targetUrl);
  const browser = await puppeteer.connect({
    browserWSEndpoint: browserlessWSEndpoint,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 960 });
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });
    await page.addScriptTag({ content: axe.source });

    const rawResults = (await page.evaluate(async () => {
      const axeRuntime = (window as Window & {
        axe?: {
          run: (context?: Element | Document, options?: unknown) => Promise<unknown>;
        };
      }).axe;

      if (!axeRuntime) {
        throw new Error('axe-core n a pas pu etre injecte dans la page');
      }

      return axeRuntime.run(document, {
        resultTypes: ['violations'],
      });
    })) as axe.AxeResults;

    const violations = rawResults.violations ?? [];
    const totalViolations = violations.reduce((sum, violation) => sum + violation.nodes.length, 0);
    const violationsByImpact = buildImpactCounts(violations);
    const categories = buildCategorySummary(violations);
    const topRules = buildTopRules(violations);
    const highlightedElements = buildHighlightedElements(violations);
    const detectedSignals = buildDetectedSignals(
      totalViolations,
      violationsByImpact,
      categories,
      topRules,
    );
    const humanAuditPoints = buildHumanAuditPoints(categories, totalViolations);
    const nonExpertSummary = buildNonExpertSummary(
      url,
      totalViolations,
      violationsByImpact,
      categories,
    );

    return {
      url,
      scannedAt: new Date().toISOString(),
      totalViolations,
      violationsByImpact,
      categories,
      topRules,
      highlightedElements,
      detectedSignals,
      humanAuditPoints,
      nonExpertSummary,
    };
  } finally {
    await browser.close();
  }
}

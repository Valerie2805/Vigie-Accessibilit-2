import type { AxeImpact, OpportunitySignalCategory, Scan } from '@/types';

const axeRuleTranslations: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  'color-contrast': {
    title: 'Contraste insuffisant',
    description:
      "Des contrastes de couleurs semblent insuffisants entre certains textes et leur arriere-plan, ce qui peut nuire a la lecture.",
  },
  'image-alt': {
    title: 'Image sans alternative textuelle',
    description:
      "Certaines images importantes semblent depourvues de texte alternatif exploitable pour les technologies d'assistance.",
  },
  'input-image-alt': {
    title: 'Bouton image sans alternative',
    description:
      "Certains boutons images ne semblent pas fournir de libelle textuel suffisant pour etre compris correctement.",
  },
  label: {
    title: 'Champ sans libelle explicite',
    description:
      'Certains champs de formulaire semblent manquer de libelle clair, ce qui peut compliquer leur utilisation.',
  },
  'button-name': {
    title: 'Bouton sans nom explicite',
    description:
      "Certains boutons semblent ne pas exposer d'intitule suffisamment clair pour les technologies d'assistance.",
  },
  'link-name': {
    title: 'Lien sans intitule explicite',
    description:
      'Certains liens semblent manquer de texte suffisamment descriptif pour indiquer clairement leur destination.',
  },
  'document-title': {
    title: 'Titre de page insuffisant',
    description:
      "La page semble ne pas exposer un titre suffisamment clair, ce qui peut gener la comprehension du contexte.",
  },
  'html-has-lang': {
    title: 'Langue de page non declaree',
    description:
      "La langue principale de la page semble absente ou mal declaree, ce qui peut affecter la lecture par les aides techniques.",
  },
  bypass: {
    title: 'Mecanisme de contournement absent',
    description:
      "Un moyen de contourner des blocs repetitifs, comme un lien d'evitement, semble manquer sur la page analysee.",
  },
  'heading-order': {
    title: 'Ordre des titres a verifier',
    description:
      "La hierarchie des titres semble perfectible, ce qui peut rendre la structure de page moins lisible.",
  },
  'aria-dialog-name': {
    title: 'Boite de dialogue sans intitule',
    description:
      "Certaines boites de dialogue semblent ne pas exposer de nom clair pour les technologies d'assistance.",
  },
  'select-name': {
    title: 'Liste de selection sans nom explicite',
    description:
      'Certaines listes de selection semblent ne pas fournir de libelle suffisamment clair.',
  },
  'duplicate-id-aria': {
    title: 'Identifiants ARIA dupliques',
    description:
      "Des identifiants utilises par des attributs ARIA semblent dupliques, ce qui peut perturber l'interpretation de la page.",
  },
  'nested-interactive': {
    title: 'Elements interactifs imbriques',
    description:
      'Des composants interactifs semblent imbriques les uns dans les autres, ce qui peut rendre les interactions ambiguës.',
  },
  'frame-title': {
    title: 'Cadre sans titre explicite',
    description:
      "Certains cadres ou contenus embarques semblent ne pas exposer de titre suffisamment clair.",
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

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateForPdf(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
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

function getRuleCategory(ruleId: string): OpportunitySignalCategory {
  const lowerRuleId = ruleId.toLowerCase();

  if (lowerRuleId.includes('color-contrast')) {
    return 'contraste';
  }

  if (
    /image-alt|input-image-alt|area-alt|object-alt|svg-img-alt|role-img-alt/.test(lowerRuleId)
  ) {
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

function getRuleDescription(
  ruleId: string,
  category?: OpportunitySignalCategory,
  impact?: AxeImpact,
) {
  const translated = axeRuleTranslations[ruleId]?.description;
  if (translated) {
    return translated;
  }

  const categoryLabel = category ? getCategoryLabel(category).toLowerCase() : 'accessibilite';
  const impactLabel = impact ? getImpactLabel(impact).toLowerCase() : 'à vérifier';

  return `Cette règle technique signale un point à vérifier sur la catégorie ${categoryLabel}, avec un niveau de gravité ${impactLabel}.`;
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
) {
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

function buildMetric(label: string, value: string, hint?: string) {
  return `
    <div class="metric">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${escapeHtml(value)}</div>
      ${hint ? `<div class="metric-hint">${escapeHtml(hint)}</div>` : ''}
    </div>
  `;
}

function buildList(items: string[]) {
  if (items.length === 0) {
    return "<p class=\"empty\">Aucun élément disponible.</p>";
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function normalizeUrl(value: string | null | undefined) {
  const url = String(value ?? '').trim();
  if (!url) {
    return '';
  }

  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function buildHtml(scan: Scan) {
  const axe = scan.axe;
  const title = `Zyrelka-analyse-${slugify(scan.companyName || scan.id || 'scan')}`;
  const scanUrl = normalizeUrl(axe?.url ?? scan.websiteUrl);

  const metrics = axe
    ? [
        buildMetric('Score', String(scan.score), 'Indicateur de priorite du scan automatique'),
        buildMetric('Violations', String(axe.totalViolations), 'Occurrences remontees automatiquement'),
        buildMetric(
          'Gravite elevee',
          String(axe.violationsByImpact.critical + axe.violationsByImpact.serious),
          'Critiques ou serieuses',
        ),
        buildMetric('Date du scan', formatDateForPdf(axe.scannedAt)),
      ].join('')
    : [
        buildMetric('Score', String(scan.score)),
        buildMetric('Evidences', String(scan.evidences.length)),
        buildMetric('URL analysee', scan.websiteUrl),
        buildMetric('Date du scan', formatDateForPdf(scan.scannedAt)),
      ].join('');

  const axeSections = axe
    ? `
      <section class="card">
        <h2>Resume commercial</h2>
        <p><strong>URL scannee :</strong> <a href="${escapeHtml(scanUrl)}">${escapeHtml(axe.url)}</a></p>
        <p>${escapeHtml(normalizeLegacyAxeText(axe.nonExpertSummary))}</p>
      </section>

      <section class="grid-two">
        <div class="card">
          <h2>Signaux detectes automatiquement</h2>
          ${buildList(axe.detectedSignals.map((item) => normalizeLegacyAxeText(item)))}
        </div>
        <div class="card">
          <h2>Points a confirmer par audit humain</h2>
          ${buildList(axe.humanAuditPoints.map((item) => normalizeLegacyAxeText(item)))}
        </div>
      </section>

      <section class="grid-two">
        <div class="card">
          <h2>Violations par gravite</h2>
          <ul>
            <li>Priorité critique : ${escapeHtml(String(axe.violationsByImpact.critical))}</li>
            <li>Important : ${escapeHtml(String(axe.violationsByImpact.serious))}</li>
            <li>À traiter : ${escapeHtml(String(axe.violationsByImpact.moderate))}</li>
            <li>Secondaire : ${escapeHtml(String(axe.violationsByImpact.minor))}</li>
          </ul>
        </div>
        <div class="card">
          <h2>Categories principales</h2>
          ${
            axe.categories.length > 0
              ? `<ul>${axe.categories
                  .map(
                    (item) =>
                      `<li>${escapeHtml(getCategoryLabel(item.category))} - ${escapeHtml(String(item.count))}</li>`,
                  )
                  .join('')}</ul>`
              : '<p class="empty">Aucune catégorie dominante.</p>'
          }
        </div>
      </section>

      <section class="card">
        <h2>Règles principales détectées</h2>
        ${
          axe.topRules.length > 0
            ? axe.topRules
                .map(
                  (rule) => `
                    <div class="item">
                      <div class="item-head">
                        <strong>${escapeHtml(getRuleTitle(rule.ruleId))}</strong>
                        <span>${escapeHtml(getImpactLabel(rule.impact))} - ${escapeHtml(String(rule.occurrences))}</span>
                      </div>
                      <p>${escapeHtml(
                        getRuleDescription(rule.ruleId, getRuleCategory(rule.ruleId), rule.impact),
                      )}</p>
                      ${
                        rule.elements.length > 0
                          ? `<ul>${rule.elements
                              .map((rawElement) => {
                                const element = normalizeRuleElement(rawElement);
                                return `<li>${escapeHtml(describeAffectedElement(element.selector, element.htmlSnippet, rule.ruleId))}${
                                    extractReadableText(element.htmlSnippet)
                                      ? `<br /><span class="muted">Contenu repéré : « ${escapeHtml(extractReadableText(element.htmlSnippet))} »</span>`
                                      : ''
                                  }</li>`;
                              })
                              .join('')}</ul>`
                          : `<p class="empty">Aucun exemple concret n'a pu être extrait automatiquement pour cette règle.</p>`
                      }
                    </div>
                  `,
                )
                .join('')
            : '<p class="empty">Aucune violation axe-core remontée.</p>'
        }
      </section>

      <section class="card">
        <h2>Zones concernées</h2>
        ${
          axe.highlightedElements.length > 0
            ? axe.highlightedElements
                .map(
                  (element) => `
                    <div class="item">
                      <div class="item-head">
                        <strong>${escapeHtml(getRuleTitle(element.ruleId))}</strong>
                        <span>${escapeHtml(getImpactLabel(element.impact))}</span>
                      </div>
                      <p>${escapeHtml(
                        describeAffectedElement(
                          element.selector,
                          element.htmlSnippet,
                          element.ruleId,
                        ),
                      )}</p>
                      ${
                        extractReadableText(element.htmlSnippet)
                          ? `<p class="muted">Contenu repéré : « ${escapeHtml(extractReadableText(element.htmlSnippet))} »</p>`
                          : ''
                      }
                    </div>
                  `,
                )
                .join('')
            : "<p class=\"empty\">Aucun extrait d'élément disponible.</p>"
        }
      </section>
    `
    : `
      <section class="card">
        <h2>Preuves detectees</h2>
        ${
          scan.evidences.length > 0
            ? scan.evidences
                .map(
                  (evidence) => `
                    <div class="item">
                      <div class="item-head">
                        <strong>${escapeHtml(evidence.label)}</strong>
                        <span>${escapeHtml(evidence.kind.replace(/_/g, ' '))}</span>
                      </div>
                      <p>${escapeHtml(evidence.sourceUrl)}</p>
                      ${evidence.excerpt ? `<p class="muted">${escapeHtml(evidence.excerpt)}</p>` : ''}
                    </div>
                  `,
                )
                .join('')
            : '<p class="empty">Aucune preuve automatique disponible.</p>'
        }
      </section>
    `;

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root {
            color-scheme: light;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 32px;
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2937;
            background: #f8fafc;
          }
          .page {
            max-width: 920px;
            margin: 0 auto;
          }
          .brand {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 24px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
          }
          .brand h1 {
            margin: 0;
            font-size: 30px;
            color: #111827;
          }
          .brand p {
            margin: 6px 0 0;
            color: #4b5563;
            line-height: 1.6;
          }
          .meta {
            text-align: right;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.6;
          }
          .grid-metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 20px;
          }
          .grid-two {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-bottom: 16px;
          }
          .metric, .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 18px;
          }
          .metric-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
          }
          .metric-value {
            margin-top: 10px;
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            word-break: break-word;
          }
          .metric-hint, .muted, .legal {
            margin-top: 8px;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.6;
          }
          h2 {
            margin: 0 0 12px;
            font-size: 16px;
            color: #111827;
          }
          p, li {
            font-size: 14px;
            line-height: 1.7;
          }
          ul {
            margin: 0;
            padding-left: 18px;
          }
          .item {
            padding: 14px 0;
            border-top: 1px solid #e5e7eb;
          }
          .item:first-child {
            padding-top: 0;
            border-top: 0;
          }
          .item-head {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
            margin-bottom: 8px;
          }
          .item-head span {
            font-size: 12px;
            color: #7c3aed;
            white-space: nowrap;
          }
          .empty {
            color: #6b7280;
          }
          .footer {
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #e5e7eb;
          }
          @media print {
            body {
              background: #ffffff;
              padding: 0;
            }
            .page {
              max-width: none;
            }
            .card, .metric {
              break-inside: avoid;
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <header class="brand">
            <div>
              <h1>Zyrelka</h1>
              <p>Rapport d'analyse d'accessibilite - signaux detectes automatiquement</p>
            </div>
            <div class="meta">
              <div>Entreprise: ${escapeHtml(scan.companyName)}</div>
              <div>SIREN: ${escapeHtml(scan.siren)}</div>
              <div>URL: <a href="${escapeHtml(scanUrl)}">${escapeHtml(axe?.url ?? scan.websiteUrl)}</a></div>
            </div>
          </header>

          <section class="grid-metrics">
            ${metrics}
          </section>

          ${axeSections}

          <section class="card">
            <h2>Notes de scan</h2>
            ${buildList(scan.notes)}
          </section>

          <footer class="footer">
            <p class="legal">
              Document Zyrelka genere a partir d'un scan automatise. Les resultats presentes correspondent a des signaux detectes automatiquement et a une exposition reglementaire estimee. Ce document ne constitue ni un avis juridique, ni une preuve de non-conformite, ni un audit complet. Les points sensibles doivent etre confirmes par audit humain.
            </p>
          </footer>
        </div>
      </body>
    </html>
  `;
}

export function exportAnalysisToPdf(scan: Scan) {
  const html = buildHtml(scan);
  const title = `Zyrelka-analyse-${slugify(scan.companyName || scan.id || 'scan')}`;
  const printWindow = window.open('', '_blank', 'width=1024,height=768');

  if (!printWindow) {
    throw new Error("La fenetre d'export PDF a ete bloquee par le navigateur");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.document.title = title;

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

import type {
  CompanyRecord,
  EligibilityStatus,
  OpportunityConfidence,
  OpportunityLeadLabel,
  OpportunityOffer,
  OpportunityRecord,
  OpportunityScores,
  OpportunitySignal,
  OpportunitySignalCategory,
  OpportunitySiteType,
  OpportunityUrgency,
  ScanEvidence,
  ScanRecord,
} from '../types.js';

type SiteContext = {
  country: string;
  sector: string | null;
  siteType: OpportunitySiteType;
  hasCriticalJourney: boolean;
  hasPdf: boolean;
  pagesScanned: number;
  isFranceOrEu: boolean;
  isSensitiveSector: boolean;
  isEcommerce: boolean;
  isHistoricallyBuyer: boolean;
  isLargeProject: boolean;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniq<T>(values: T[]) {
  return Array.from(new Set(values));
}

function getDomainFromUrl(websiteUrl: string | null) {
  if (!websiteUrl) {
    return null;
  }

  try {
    return new URL(websiteUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function getPathFromUrl(sourceUrl: string) {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.pathname || '/';
  } catch {
    return '/';
  }
}

function inferSector(company: CompanyRecord) {
  const activity = (company.activite ?? '').toUpperCase();
  if (activity.startsWith('47')) return 'e-commerce';
  if (activity.startsWith('62') || activity.startsWith('63')) return 'technologies et services de l information';
  if (activity.startsWith('64') || activity.startsWith('65') || activity.startsWith('66'))
    return 'finance';
  if (activity.startsWith('49') || activity.startsWith('50') || activity.startsWith('51') || activity.startsWith('52') || activity.startsWith('53'))
    return 'transport';
  if (activity.startsWith('58') || activity.startsWith('59') || activity.startsWith('60'))
    return 'media';
  if (activity.startsWith('84')) return 'public';
  if (activity.startsWith('86') || activity.startsWith('87') || activity.startsWith('88'))
    return 'sante';
  if (activity.startsWith('85')) return 'education';
  if (activity.startsWith('68')) return 'immobilier';
  if (activity.startsWith('55') || activity.startsWith('56')) return 'tourisme';
  return company.activite?.toLowerCase() ?? null;
}

function inferSiteType(company: CompanyRecord, scan: ScanRecord) {
  const keywords = [
    scan.websiteUrl,
    ...scan.evidences.map((evidence) => evidence.sourceUrl),
    ...scan.notes,
  ].join(' ').toLowerCase();

  if (/(checkout|cart|panier|commande|paiement|booking|reservation|shop|produit)/.test(keywords)) {
    return 'transactionnel' as const;
  }

  if (/(login|connexion|espace-client|portail|account|mon-compte|client)/.test(keywords)) {
    return 'portail_client' as const;
  }

  const sector = inferSector(company);
  if (sector === 'media') {
    return 'media' as const;
  }

  const uniquePages = uniq(scan.evidences.map((evidence) => getPathFromUrl(evidence.sourceUrl)));
  if (uniquePages.length <= 2 && company.categorieEntreprise === 'PME') {
    return 'vitrine' as const;
  }

  if (uniquePages.length >= 4 || company.categorieEntreprise === 'GE') {
    return 'corporate' as const;
  }

  return 'unknown' as const;
}

function buildContext(company: CompanyRecord, scan: ScanRecord): SiteContext {
  const sector = inferSector(company);
  const siteType = inferSiteType(company, scan);
  const urls = [scan.websiteUrl, ...scan.evidences.map((evidence) => evidence.sourceUrl)].join(' ').toLowerCase();
  const pagesScanned = Math.max(uniq(scan.evidences.map((evidence) => getPathFromUrl(evidence.sourceUrl))).length, 1);
  const hasCriticalJourney =
    siteType === 'transactionnel' ||
    siteType === 'portail_client' ||
    /(checkout|cart|panier|commande|paiement|booking|reservation|login|connexion|account|client)/.test(
      urls,
    );
  const hasPdf = scan.evidences.some((evidence) => evidence.sourceUrl.toLowerCase().includes('.pdf'));
  const isFranceOrEu = true;
  const isSensitiveSector = ['finance', 'transport', 'sante', 'public', 'media', 'e-commerce'].includes(
    sector ?? '',
  );
  const isEcommerce = sector === 'e-commerce' || siteType === 'transactionnel';
  const isHistoricallyBuyer = ['e-commerce', 'finance', 'technologies et services de l information', 'media'].includes(
    sector ?? '',
  );
  const isLargeProject =
    company.categorieEntreprise === 'GE' ||
    pagesScanned >= 4 ||
    company.trancheEffectif === '1000+' ||
    company.trancheEffectif === '500-999';

  return {
    country: 'FR',
    sector,
    siteType,
    hasCriticalJourney,
    hasPdf,
    pagesScanned,
    isFranceOrEu,
    isSensitiveSector,
    isEcommerce,
    isHistoricallyBuyer,
    isLargeProject,
  };
}

function createSignal(
  category: OpportunitySignalCategory,
  severity: OpportunitySignal['severity'],
  confidence: OpportunityConfidence,
  countEstimate: number,
  affectedPages: string[],
): OpportunitySignal {
  return {
    category,
    severity,
    confidence,
    detectedAutomatically: true,
    countEstimate,
    affectedPages: uniq(affectedPages).slice(0, 6),
  };
}

function normalizeSignals(
  company: CompanyRecord,
  scan: ScanRecord,
  context: SiteContext,
): OpportunitySignal[] {
  const signals: OpportunitySignal[] = [];
  const affectedPages = uniq(scan.evidences.map((evidence) => getPathFromUrl(evidence.sourceUrl)));

  if (scan.status === 'conformite_non_demontree' || scan.status === 'a_verifier_manuellement') {
    signals.push(
      createSignal(
        'erreurs_recurrentes_globales',
        context.hasCriticalJourney || scan.eligibility === 'soumis_probable' ? 'high' : 'medium',
        context.pagesScanned >= 3 ? 'medium' : 'low',
        Math.max(3, context.pagesScanned),
        affectedPages,
      ),
    );
  }

  if (context.hasCriticalJourney) {
    signals.push(
      createSignal(
        'formulaires',
        scan.status === 'conformite_non_demontree' ? 'high' : 'medium',
        'low',
        Math.max(2, context.pagesScanned),
        affectedPages.filter((page) =>
          /(checkout|cart|panier|commande|login|connexion|account|client|contact)/.test(page),
        ),
      ),
    );
  }

  if (context.hasPdf) {
    signals.push(
      createSignal('documents_pdf', 'medium', 'medium', 1, affectedPages.filter((page) => page.includes('.pdf'))),
    );
  }

  if (scan.evidences.length >= 3) {
    signals.push(
      createSignal(
        'structure_semantique',
        'medium',
        'medium',
        scan.evidences.length,
        affectedPages,
      ),
    );
  }

  return signals;
}

function computeProblemScore(signals: OpportunitySignal[], context: SiteContext) {
  let score = 10;

  for (const signal of signals) {
    if (signal.category === 'navigation_clavier' && signal.severity === 'high') score += 25;
    if (signal.category === 'formulaires' && signal.severity === 'high') score += 20;
    if (signal.category === 'documents_pdf' && signal.severity !== 'low') score += 5;
    if (signal.category === 'erreurs_recurrentes_globales' && signal.severity === 'high') score += 18;
  }

  if (context.hasCriticalJourney) score += 15;
  if (signals.length >= 2) score += 10;
  if (context.pagesScanned >= 3) score += 10;
  if (context.pagesScanned <= 2) score -= 10;
  if (signals.every((signal) => signal.confidence === 'low')) score -= 10;

  return clamp(score);
}

function computeRegulatoryExposure(
  context: SiteContext,
  eligibility: EligibilityStatus,
  scan: ScanRecord,
) {
  let score = 5;
  if (context.isFranceOrEu) score += 25;
  if (context.isEcommerce) score += 20;
  if (context.isSensitiveSector) score += 20;
  if (context.hasCriticalJourney) score += 15;
  if (scan.status === 'conformite_non_demontree' || scan.status === 'a_verifier_manuellement') score += 10;
  if (context.siteType === 'vitrine' && !context.hasCriticalJourney) score -= 10;
  if (eligibility === 'soumis_probable') score += 10;

  return clamp(score);
}

function computeBusinessValue(context: SiteContext, signals: OpportunitySignal[], company: CompanyRecord) {
  let score = 10;
  if (context.isLargeProject) score += 20;
  if (context.hasCriticalJourney) score += 20;
  if (context.isHistoricallyBuyer) score += 15;
  if (signals.length >= 2) score += 15;
  if (context.siteType === 'transactionnel' || context.siteType === 'portail_client') score += 10;
  if (context.isLargeProject || company.categorieEntreprise === 'GE') score += 10;
  if (context.siteType === 'vitrine' && company.categorieEntreprise === 'PME') score -= 10;

  return clamp(score);
}

function computeDataConfidence(context: SiteContext, signals: OpportunitySignal[]) {
  let score = 10;
  const mediumOrHighSignals = signals.filter((signal) => signal.confidence !== 'low').length;

  if (mediumOrHighSignals >= 2) score += 30;
  if (context.pagesScanned >= 3) score += 20;
  if (context.hasCriticalJourney) score += 20;
  if (context.sector && context.country) score += 10;
  if (context.pagesScanned <= 1) score -= 20;
  if (signals.length === 0) score -= 20;

  return clamp(score);
}

function getLeadLabel(leadScore: number): OpportunityLeadLabel {
  if (leadScore >= 80) return 'chaud';
  if (leadScore >= 50) return 'tiede';
  return 'froid';
}

function getRegulatoryUrgency(
  regulatoryExposureScore: number,
  context: SiteContext,
  signals: OpportunitySignal[],
): OpportunityUrgency {
  const severeSignals = signals.some((signal) => signal.severity === 'high');
  if (regulatoryExposureScore >= 70 && context.hasCriticalJourney && severeSignals) return 'elevee';
  if (regulatoryExposureScore >= 45) return 'moyenne';
  return 'faible';
}

function computeScores(
  company: CompanyRecord,
  scan: ScanRecord,
  signals: OpportunitySignal[],
  context: SiteContext,
): OpportunityScores {
  const problemScore = computeProblemScore(signals, context);
  const regulatoryExposureScore = computeRegulatoryExposure(context, scan.eligibility, scan);
  const businessValueScore = computeBusinessValue(context, signals, company);
  const dataConfidenceScore = computeDataConfidence(context, signals);
  const leadScore = clamp(
    0.35 * problemScore +
      0.3 * regulatoryExposureScore +
      0.25 * businessValueScore +
      0.1 * dataConfidenceScore,
  );

  return {
    leadScore,
    leadLabel: getLeadLabel(leadScore),
    regulatoryUrgency: getRegulatoryUrgency(regulatoryExposureScore, context, signals),
    problemScore,
    regulatoryExposureScore,
    businessValueScore,
    dataConfidenceScore,
  };
}

function getOfferReason(primary: OpportunityOffer, context: SiteContext) {
  switch (primary) {
    case 'audit_flash':
      return 'Le site semble simple et demande surtout une premiere priorisation actionnable.';
    case 'audit_complet':
      return 'Plusieurs signaux meritent une analyse plus structuree pour confirmer les priorites.';
    case 'audit_complet_plus_remediation':
      return 'La dette accessibilite semble deja visible sur des parcours critiques et justifie une correction priorisee.';
    case 'mise_en_conformite_rgaa_eaa':
      return 'Le contexte FR/UE et l exposition estimee rendent une trajectoire de mise en conformite plus pertinente.';
    case 'monitoring_continu':
      return 'Le site semble deja structure mais demande un suivi pour eviter les regressions.';
    case 'formation_plus_accompagnement':
      return 'Les signaux laissent penser a un besoin de montee en competence et d accompagnement d equipe.';
    default:
      return 'Les signaux repetes laissent penser a un probleme transversal au niveau des composants reutilisables.';
  }
}

function recommendOffer(
  scores: OpportunityScores,
  context: SiteContext,
  signals: OpportunitySignal[],
): OpportunityRecord['recommendedOffer'] {
  let primary: OpportunityOffer = 'audit_flash';
  let secondary: OpportunityOffer | null = null;

  if (scores.regulatoryUrgency === 'elevee' && context.isFranceOrEu) {
    primary = 'mise_en_conformite_rgaa_eaa';
    secondary = 'audit_complet_plus_remediation';
  } else if (scores.problemScore >= 65 && context.hasCriticalJourney) {
    primary = 'audit_complet_plus_remediation';
    secondary = 'monitoring_continu';
  } else if (signals.length >= 2) {
    primary = 'audit_complet';
    secondary = context.isLargeProject ? 'audit_design_system_front' : null;
  } else if (context.siteType === 'vitrine') {
    primary = 'audit_flash';
  }

  if (signals.some((signal) => signal.category === 'structure_semantique') && context.isLargeProject) {
    secondary = 'audit_design_system_front';
  }

  return {
    primary,
    secondary,
    reason: getOfferReason(primary, context),
  };
}

function getSignalLabel(category: OpportunitySignalCategory) {
  switch (category) {
    case 'erreurs_recurrentes_globales':
      return 'des signaux globaux de dette accessibilite';
    case 'formulaires':
      return 'des points sensibles sur les formulaires et parcours critiques';
    case 'documents_pdf':
      return 'des documents PDF potentiellement a traiter';
    case 'structure_semantique':
      return 'des indices de probleme structurel transverse';
    default:
      return category.replace(/_/g, ' ');
  }
}

function generateWhyNow(
  scores: OpportunityScores,
  context: SiteContext,
  signals: OpportunitySignal[],
) {
  const leadSignal = signals[0];
  if (scores.regulatoryUrgency === 'elevee') {
    return 'Le site presente des signaux forts sur des parcours critiques dans un contexte reglementaire sensible. Un contact rapide est pertinent, tout en gardant une lecture prudente et confirmee par audit humain.';
  }

  if (context.hasCriticalJourney && leadSignal) {
    return `Les defauts detectes semblent toucher des parcours business importants, notamment ${getSignalLabel(
      leadSignal.category,
    )}. Cela suggere une opportunite concrete d audit suivi d une priorisation des corrections.`;
  }

  return 'L absence apparente de signaux visibles de conformite, combinee a plusieurs indices techniques, justifie un premier contact pour cadrer rapidement les priorites.';
}

function getOfferLabel(offer: OpportunityOffer) {
  switch (offer) {
    case 'audit_flash':
      return 'un audit flash';
    case 'audit_complet':
      return 'un audit complet';
    case 'audit_complet_plus_remediation':
      return 'un audit complet avec remediation priorisee';
    case 'mise_en_conformite_rgaa_eaa':
      return 'une trajectoire de mise en conformite RGAA/EAA';
    case 'monitoring_continu':
      return 'un monitoring continu';
    case 'formation_plus_accompagnement':
      return 'une formation avec accompagnement';
    default:
      return 'un audit du design system et du front';
  }
}

function generateOutreach(
  company: CompanyRecord,
  scores: OpportunityScores,
  offer: OpportunityRecord['recommendedOffer'],
  signals: OpportunitySignal[],
) {
  const topSignals = signals.slice(0, 2).map((signal) => getSignalLabel(signal.category));
  const signalText =
    topSignals.length > 0 ? topSignals.join(' et ') : 'plusieurs signaux d accessibilite a confirmer';
  const urgencyText =
    scores.regulatoryUrgency === 'elevee'
      ? 'un contexte potentiellement prioritaire'
      : 'un contexte qui merite une verification rapide';
  const offerLabel = getOfferLabel(offer.primary);

  return {
    emailSubject: 'Accessibilite : points critiques detectes sur vos parcours cles',
    emailBody: `Bonjour,\n\nNous avons releve sur votre site ${signalText}. Dans votre contexte, cela peut representer ${urgencyText}, tout en restant a confirmer par audit humain.\n\nL action la plus pertinente semble etre ${offerLabel}, afin d identifier les points les plus critiques et de prioriser la remediation.\n\nSouhaitez-vous un echange court pour voir les priorites principales ?\n\nBien a vous`,
    linkedinMessage: `Bonjour, nous avons releve plusieurs signaux d accessibilite sur des parcours cles du site ${company.nom}. Je peux vous partager une lecture synthétique des priorites et de l action la plus pertinente si cela vous interesse.`,
  };
}

function buildExplanations(
  company: CompanyRecord,
  scan: ScanRecord,
  scores: OpportunityScores,
  context: SiteContext,
  signals: OpportunitySignal[],
) {
  const explanations: string[] = [];

  if (context.sector) {
    explanations.push(`Secteur estime : ${context.sector}`);
  }
  if (context.hasCriticalJourney) {
    explanations.push('Parcours critiques detectes ou fortement suspectes');
  }
  if (scan.eligibility === 'soumis_probable') {
    explanations.push('Exposition reglementaire probable deja estimee cote entreprise');
  }
  if (signals.length > 0) {
    explanations.push(
      `Signaux detectes automatiquement : ${signals
        .map((signal) => signal.category.replace(/_/g, ' '))
        .join(', ')}`,
    );
  }
  explanations.push(
    `Pourquoi ce score : problemes ${scores.problemScore}/100, exposition ${scores.regulatoryExposureScore}/100, valeur ${scores.businessValueScore}/100, confiance ${scores.dataConfidenceScore}/100`,
  );
  explanations.push('Ces resultats restent des signaux detectes automatiquement et des points a confirmer par audit humain.');

  return explanations;
}

export function buildOpportunity(company: CompanyRecord, scan: ScanRecord): OpportunityRecord {
  const context = buildContext(company, scan);
  const signals = normalizeSignals(company, scan, context);
  const scores = computeScores(company, scan, signals, context);
  const recommendedOffer = recommendOffer(scores, context, signals);
  const whyNow = generateWhyNow(scores, context, signals);
  const outreach = generateOutreach(company, scores, recommendedOffer, signals);
  const explanations = buildExplanations(company, scan, scores, context, signals);
  const now = new Date().toISOString();

  return {
    id: `opp_${scan.id}`,
    siren: company.siren,
    scanId: scan.id,
    site: {
      name: company.nom,
      domain: getDomainFromUrl(company.websiteUrl ?? scan.websiteUrl),
      url: company.websiteUrl ?? scan.websiteUrl,
      country: context.country,
      sector: context.sector,
      siteType: context.siteType,
    },
    scan: {
      scannedAt: scan.scannedAt,
      pagesScanned: context.pagesScanned,
      confidence:
        scores.dataConfidenceScore >= 70
          ? 'high'
          : scores.dataConfidenceScore >= 45
            ? 'medium'
            : 'low',
    },
    signals,
    scores,
    recommendedOffer,
    whyNow,
    outreach,
    explanations,
    status: 'new',
    createdAt: now,
    updatedAt: now,
  };
}

export function refreshOpportunity(
  previous: OpportunityRecord | null,
  company: CompanyRecord,
  scan: ScanRecord,
) {
  const rebuilt = buildOpportunity(company, scan);
  if (!previous) {
    return rebuilt;
  }

  return {
    ...rebuilt,
    status: previous.status,
    createdAt: previous.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

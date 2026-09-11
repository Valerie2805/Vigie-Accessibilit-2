import type {
  CompanySearchResult,
  EligibilityStatus,
  ScanEvidence,
  ScanStatus,
} from '../types.js';

const PUBLIC_SECTORS = new Set(['GE']);
const EAA_ACTIVITY_PREFIXES = ['47', '49', '50', '51', '58', '61', '64', '66'];

export function estimateEligibility(company: CompanySearchResult): EligibilityStatus {
  if (company.chiffreAffaires !== null && company.chiffreAffaires >= 250_000_000) {
    return 'soumis_probable';
  }

  if (company.categorieEntreprise && PUBLIC_SECTORS.has(company.categorieEntreprise)) {
    return 'soumis_probable';
  }

  const activityPrefix = company.activite?.slice(0, 2);
  if (activityPrefix && EAA_ACTIVITY_PREFIXES.includes(activityPrefix)) {
    return 'incertain';
  }

  return 'hors_perimetre_probable';
}

export function computeScore(
  eligibility: EligibilityStatus,
  evidences: ScanEvidence[],
  websiteResolved: boolean,
) {
  let score = 0;
  let status: ScanStatus = 'a_verifier_manuellement';

  const evidenceKinds = new Set(evidences.map((evidence) => evidence.kind));

  if (evidenceKinds.has('page_accessibilite')) {
    score += 40;
  }
  if (evidenceKinds.has('declaration')) {
    score += 25;
  }
  if (evidenceKinds.has('mention_accueil')) {
    score += 15;
  }
  if (evidenceKinds.has('contact_accessibilite')) {
    score += 10;
  }

  const keywordCount = evidences.filter((evidence) => evidence.kind === 'mot_cle').length;
  score += Math.min(keywordCount * 5, 10);

  if (!websiteResolved) {
    score -= 20;
  }

  if (eligibility === 'soumis_probable' && evidences.length === 0) {
    score -= 30;
  }

  if (score >= 65) {
    status = 'elements_detectes';
  } else if (score >= 25) {
    status = 'elements_partiels';
  } else if (score <= 0 && websiteResolved) {
    status = 'conformite_non_demontree';
  }

  return {
    score,
    status,
  };
}

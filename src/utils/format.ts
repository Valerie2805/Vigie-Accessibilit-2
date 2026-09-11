import type {
  EligibilityStatus,
  OpportunityConfidence,
  OpportunityLeadLabel,
  OpportunityOffer,
  OpportunityStatus,
  OpportunityUrgency,
  ScanStatus,
} from '@/types';

const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatCurrency(value: number | null) {
  if (value === null) {
    return 'Non disponible';
  }

  return currencyFormatter.format(value);
}

export function getEffectifLabel(value: string | null) {
  switch (value) {
    case '00':
      return '0 salarie';
    case '01':
      return '1 a 2 salaries';
    case '02':
      return '3 a 5 salaries';
    case '03':
      return '6 a 9 salaries';
    case '11':
      return '10 a 19 salaries';
    case '12':
      return '20 a 49 salaries';
    case '21':
      return '50 a 99 salaries';
    case '22':
      return '100 a 199 salaries';
    case '31':
      return '200 a 249 salaries';
    case '32':
      return '250 a 499 salaries';
    case '41':
      return '500 a 999 salaries';
    case '42':
      return '1 000 a 1 999 salaries';
    case '51':
      return '2 000 a 4 999 salaries';
    case '52':
      return '5 000 a 9 999 salaries';
    case '53':
      return '10 000 salaries et plus';
    default:
      return 'Non disponible';
  }
}

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function getEligibilityLabel(status: EligibilityStatus) {
  switch (status) {
    case 'soumis_probable':
      return 'Soumis probable';
    case 'hors_perimetre_probable':
      return 'Hors perimetre probable';
    default:
      return 'Perimetre incertain';
  }
}

export function getScanStatusLabel(status: ScanStatus) {
  switch (status) {
    case 'elements_detectes':
      return 'Elements detectes';
    case 'elements_partiels':
      return 'Elements partiels';
    case 'conformite_non_demontree':
      return 'Conformite non demontree';
    default:
      return 'A verifier manuellement';
  }
}

export function getOpportunityLeadLabel(label: OpportunityLeadLabel) {
  switch (label) {
    case 'chaud':
      return 'Chaud';
    case 'tiede':
      return 'Tiede';
    default:
      return 'Froid';
  }
}

export function getOpportunityUrgencyLabel(urgency: OpportunityUrgency) {
  switch (urgency) {
    case 'elevee':
      return 'Elevee';
    case 'moyenne':
      return 'Moyenne';
    default:
      return 'Faible';
  }
}

export function getOpportunityConfidenceLabel(confidence: OpportunityConfidence) {
  switch (confidence) {
    case 'high':
      return 'Haute';
    case 'medium':
      return 'Moyenne';
    default:
      return 'Faible';
  }
}

export function getOpportunityStatusLabel(status: OpportunityStatus) {
  switch (status) {
    case 'new':
      return 'Nouveau';
    case 'reviewed':
      return 'Revu';
    case 'contacted':
      return 'Contacte';
    case 'qualified':
      return 'Qualifie';
    default:
      return 'Ecarte';
  }
}

export function getOpportunityOfferLabel(offer: OpportunityOffer) {
  switch (offer) {
    case 'audit_flash':
      return 'Audit flash';
    case 'audit_complet':
      return 'Audit complet';
    case 'audit_complet_plus_remediation':
      return 'Audit complet + remediation';
    case 'mise_en_conformite_rgaa_eaa':
      return 'Mise en conformite RGAA / EAA';
    case 'monitoring_continu':
      return 'Monitoring continu';
    case 'formation_plus_accompagnement':
      return 'Formation + accompagnement';
    default:
      return 'Audit design system / front';
  }
}
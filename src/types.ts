export type EligibilityStatus =
  | 'soumis_probable'
  | 'hors_perimetre_probable'
  | 'incertain';

export type ScanStatus =
  | 'elements_detectes'
  | 'elements_partiels'
  | 'conformite_non_demontree'
  | 'a_verifier_manuellement';

export type AxeImpact = 'critical' | 'serious' | 'moderate' | 'minor' | 'unknown';

export type AxeRuleElementSummary = {
  selector: string;
  htmlSnippet: string;
};

export type AxeRuleSummary = {
  ruleId: string;
  impact: AxeImpact;
  help: string;
  description: string;
  helpUrl: string;
  occurrences: number;
  elements: AxeRuleElementSummary[];
};

export type AxeCategorySummary = {
  category: OpportunitySignalCategory;
  count: number;
  severity: OpportunitySeverity;
};

export type AxeHighlightedElement = {
  ruleId: string;
  impact: AxeImpact;
  selector: string;
  htmlSnippet: string;
};

export type AxeScanSummary = {
  url: string;
  scannedAt: string;
  totalViolations: number;
  violationsByImpact: Record<AxeImpact, number>;
  categories: AxeCategorySummary[];
  topRules: AxeRuleSummary[];
  highlightedElements: AxeHighlightedElement[];
  detectedSignals: string[];
  humanAuditPoints: string[];
  nonExpertSummary: string;
};

export type RgaaProspectLevel =
  | 'fort_probable'
  | 'probable'
  | 'faible'
  | 'a_verifier';

export type RgaaProspectScore = {
  level: RgaaProspectLevel;
  score: number;
  signals: string[];
  scannedUrl: string | null;
};

export type Company = {
  siren: string;
  nom: string;
  ville: string | null;
  codePostal: string | null;
  activite: string | null;
  categorieEntreprise: string | null;
  trancheEffectif: string | null;
  adresse: string | null;
  chiffreAffaires: number | null;
  source: 'api_recherche_entreprises' | 'demo';
  websiteUrl: string | null;
  websiteSource: 'google_places' | 'recherche_web' | 'manuel' | 'inconnue';
  websiteConfidence: 'haute' | 'moyenne' | 'faible';
  websiteRedesignYear: number | null;
  email: string | null;
  lastSeenAt?: string;
  eligibility: EligibilityStatus;
  latestScanStatus?: ScanStatus | null;
  latestScannedAt?: string | null;
  lastExportedAt?: string | null;
  rgaaProspectScore?: RgaaProspectScore | null;
};

export type WebsiteResolution = {
  websiteUrl: string | null;
  source: 'google_places' | 'recherche_web' | 'manuel' | 'inconnue';
  confidence: 'haute' | 'moyenne' | 'faible';
  websiteRedesignYear: number | null;
  notes: string[];
};

export type ScanEvidence = {
  id: string;
  kind:
    | 'page_accessibilite'
    | 'declaration'
    | 'mention_accueil'
    | 'contact_accessibilite'
    | 'mot_cle';
  label: string;
  sourceUrl: string;
  excerpt?: string;
};

export type Scan = {
  id: string;
  siren: string;
  companyName: string;
  websiteUrl: string;
  score: number;
  status: ScanStatus;
  eligibility: EligibilityStatus;
  scannedAt: string;
  evidences: ScanEvidence[];
  notes: string[];
  axe?: AxeScanSummary | null;
};

export type OpportunitySignalCategory =
  | 'contraste'
  | 'images_sans_alternative'
  | 'structure_semantique'
  | 'navigation_clavier'
  | 'formulaires'
  | 'menus_modales_popups'
  | 'composants_interactifs'
  | 'documents_pdf'
  | 'medias'
  | 'erreurs_recurrentes_globales';

export type OpportunitySeverity = 'low' | 'medium' | 'high';
export type OpportunityConfidence = 'low' | 'medium' | 'high';
export type OpportunityLeadLabel = 'froid' | 'tiede' | 'chaud';
export type OpportunityUrgency = 'faible' | 'moyenne' | 'elevee';
export type OpportunityStatus =
  | 'new'
  | 'reviewed'
  | 'contacted'
  | 'qualified'
  | 'discarded';
export type OpportunitySiteType =
  | 'vitrine'
  | 'corporate'
  | 'transactionnel'
  | 'portail_client'
  | 'media'
  | 'unknown';
export type OpportunityOffer =
  | 'audit_flash'
  | 'audit_complet'
  | 'audit_complet_plus_remediation'
  | 'mise_en_conformite_rgaa_eaa'
  | 'monitoring_continu'
  | 'formation_plus_accompagnement'
  | 'audit_design_system_front';

export type OpportunitySignal = {
  category: OpportunitySignalCategory;
  severity: OpportunitySeverity;
  confidence: OpportunityConfidence;
  detectedAutomatically: boolean;
  countEstimate: number;
  affectedPages: string[];
};

export type Opportunity = {
  id: string;
  siren: string;
  scanId: string | null;
  site: {
    name: string;
    domain: string | null;
    url: string | null;
    country: string;
    sector: string | null;
    siteType: OpportunitySiteType;
  };
  scan: {
    scannedAt: string | null;
    pagesScanned: number;
    confidence: OpportunityConfidence;
  };
  signals: OpportunitySignal[];
  scores: {
    leadScore: number;
    leadLabel: OpportunityLeadLabel;
    regulatoryUrgency: OpportunityUrgency;
    problemScore: number;
    regulatoryExposureScore: number;
    businessValueScore: number;
    dataConfidenceScore: number;
  };
  recommendedOffer: {
    primary: OpportunityOffer;
    secondary: OpportunityOffer | null;
    reason: string;
  };
  whyNow: string;
  outreach: {
    emailSubject: string;
    emailBody: string;
    linkedinMessage: string;
  };
  explanations: string[];
  status: OpportunityStatus;
  createdAt: string;
  updatedAt: string;
  lastExportedAt?: string | null;
};
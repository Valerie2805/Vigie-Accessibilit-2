import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type {
  CompanyRecord,
  CompanySearchResult,
  OpportunityRecord,
  OpportunityStatus,
  ScanRecord,
  WebsiteResolution,
} from '../types.js';

type StorageShape = {
  scans: ScanRecord[];
  companies: CompanyRecord[];
  opportunities: OpportunityRecord[];
};

type SupabaseCompanyRow = {
  siren: string;
  payload: CompanyRecord;
  website_url: string | null;
  email: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseScanRow = {
  id: string;
  siren: string;
  company_name: string;
  website_url: string;
  score: number;
  status: string;
  eligibility: string;
  scanned_at: string;
  payload: ScanRecord;
  created_at: string;
};

type SupabaseOpportunityRow = {
  id: string;
  scan_id: string | null;
  siren: string;
  lead_score: number;
  regulatory_urgency: string;
  status: string;
  primary_offer: string | null;
  payload: OpportunityRecord;
  created_at: string;
  updated_at: string;
};

const dataDirectory = path.resolve(process.cwd(), 'data');
const dataFilePath = path.join(dataDirectory, 'scans.json');
const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
let memoryStorage: StorageShape = {
  scans: [],
  companies: [],
  opportunities: [],
};
let hasWarnedAboutSupabaseFallback = false;

function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

function logSupabaseFallback(error: unknown, operation: 'read' | 'write') {
  if (!hasWarnedAboutSupabaseFallback) {
    hasWarnedAboutSupabaseFallback = true;
    console.error(
      `Supabase ${operation} failed, fallback to local storage enabled:`,
      error,
    );
    return;
  }

  console.error(`Supabase ${operation} failed, using local fallback.`);
}

function ensureStorageFile() {
  try {
    if (!existsSync(dataDirectory)) {
      mkdirSync(dataDirectory, { recursive: true });
    }

    if (!existsSync(dataFilePath)) {
      writeFileSync(
        dataFilePath,
        JSON.stringify({ scans: [], companies: [], opportunities: [] }, null, 2),
      );
    }

    return true;
  } catch {
    return false;
  }
}

function normalizeCompanyRecord(company: Partial<CompanyRecord>): CompanyRecord {
  return {
    siren: company.siren ?? '',
    nom: company.nom ?? '',
    ville: company.ville ?? null,
    codePostal: company.codePostal ?? null,
    activite: company.activite ?? null,
    categorieEntreprise: company.categorieEntreprise ?? null,
    trancheEffectif: company.trancheEffectif ?? null,
    adresse: company.adresse ?? null,
    chiffreAffaires: company.chiffreAffaires ?? null,
    source: company.source ?? 'demo',
    websiteUrl: company.websiteUrl ?? null,
    websiteSource: company.websiteSource ?? 'inconnue',
    websiteConfidence: company.websiteConfidence ?? 'faible',
    websiteRedesignYear: company.websiteRedesignYear ?? null,
    websiteNotes: company.websiteNotes ?? [],
    email: company.email ?? null,
    emailSource: company.emailSource ?? 'inconnue',
    emailNotes: company.emailNotes ?? [],
    lastSeenAt: company.lastSeenAt ?? new Date().toISOString(),
    lastExportedAt: company.lastExportedAt ?? null,
  };
}

function normalizeScanRecord(scan: Partial<ScanRecord>): ScanRecord {
  return {
    id: scan.id ?? '',
    siren: scan.siren ?? '',
    companyName: scan.companyName ?? '',
    websiteUrl: scan.websiteUrl ?? '',
    score: scan.score ?? 0,
    status: scan.status ?? 'a_verifier_manuellement',
    eligibility: scan.eligibility ?? 'incertain',
    scannedAt: scan.scannedAt ?? new Date().toISOString(),
    evidences: scan.evidences ?? [],
    notes: scan.notes ?? [],
    axe: scan.axe ?? null,
  };
}

function normalizeOpportunityRecord(opportunity: Partial<OpportunityRecord>): OpportunityRecord {
  return {
    id: opportunity.id ?? '',
    siren: opportunity.siren ?? '',
    scanId: opportunity.scanId ?? null,
    site: {
      name: opportunity.site?.name ?? '',
      domain: opportunity.site?.domain ?? null,
      url: opportunity.site?.url ?? null,
      country: opportunity.site?.country ?? 'FR',
      sector: opportunity.site?.sector ?? null,
      siteType: opportunity.site?.siteType ?? 'unknown',
    },
    scan: {
      scannedAt: opportunity.scan?.scannedAt ?? null,
      pagesScanned: opportunity.scan?.pagesScanned ?? 0,
      confidence: opportunity.scan?.confidence ?? 'low',
    },
    signals: opportunity.signals ?? [],
    scores: {
      leadScore: opportunity.scores?.leadScore ?? 0,
      leadLabel: opportunity.scores?.leadLabel ?? 'froid',
      regulatoryUrgency: opportunity.scores?.regulatoryUrgency ?? 'faible',
      problemScore: opportunity.scores?.problemScore ?? 0,
      regulatoryExposureScore: opportunity.scores?.regulatoryExposureScore ?? 0,
      businessValueScore: opportunity.scores?.businessValueScore ?? 0,
      dataConfidenceScore: opportunity.scores?.dataConfidenceScore ?? 0,
    },
    recommendedOffer: {
      primary: opportunity.recommendedOffer?.primary ?? 'audit_flash',
      secondary: opportunity.recommendedOffer?.secondary ?? null,
      reason: opportunity.recommendedOffer?.reason ?? '',
    },
    whyNow: opportunity.whyNow ?? '',
    outreach: {
      emailSubject: opportunity.outreach?.emailSubject ?? '',
      emailBody: opportunity.outreach?.emailBody ?? '',
      linkedinMessage: opportunity.outreach?.linkedinMessage ?? '',
    },
    explanations: opportunity.explanations ?? [],
    status: opportunity.status ?? 'new',
    createdAt: opportunity.createdAt ?? new Date().toISOString(),
    updatedAt: opportunity.updatedAt ?? new Date().toISOString(),
    lastExportedAt: opportunity.lastExportedAt ?? null,
  };
}

function normalizeStorage(parsed: Partial<StorageShape>): StorageShape {
  return {
    scans: (parsed.scans ?? []).map((scan) => normalizeScanRecord(scan)),
    companies: (parsed.companies ?? []).map((company) => normalizeCompanyRecord(company)),
    opportunities: (parsed.opportunities ?? []).map((opportunity) =>
      normalizeOpportunityRecord(opportunity),
    ),
  };
}

function readStorageFromFile(): StorageShape {
  if (!ensureStorageFile()) {
    return memoryStorage;
  }

  try {
    const raw = readFileSync(dataFilePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StorageShape>;
    const normalized = normalizeStorage(parsed);
    memoryStorage = normalized;
    return normalized;
  } catch {
    return memoryStorage;
  }
}

function writeStorageToFile(payload: StorageShape) {
  memoryStorage = payload;
  if (!ensureStorageFile()) {
    return;
  }

  try {
    writeFileSync(dataFilePath, JSON.stringify(payload, null, 2));
  } catch {
    // On Vercel serverless, filesystem may be read-only. We keep data in memory for the runtime.
  }
}

async function supabaseRequest<T>(table: string, init?: RequestInit, searchParams?: URLSearchParams) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  if (searchParams) {
    url.search = searchParams.toString();
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      ...(init?.headers ?? {}),
    },
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${raw}`);
  }

  if (!raw.trim()) {
    return null as T;
  }

  return JSON.parse(raw) as T;
}

async function readStorageFromSupabase(): Promise<StorageShape> {
  const companyParams = new URLSearchParams({
    select: 'payload',
    order: 'last_seen_at.desc',
    limit: '200',
  });
  const scanParams = new URLSearchParams({
    select: 'payload',
    order: 'scanned_at.desc',
    limit: '100',
  });
  const opportunityParams = new URLSearchParams({
    select: 'payload',
    order: 'updated_at.desc',
    limit: '200',
  });

  const [companyRows, scanRows, opportunityRows] = await Promise.all([
    supabaseRequest<Array<Pick<SupabaseCompanyRow, 'payload'>>>('vigie_companies', undefined, companyParams),
    supabaseRequest<Array<Pick<SupabaseScanRow, 'payload'>>>('vigie_scans', undefined, scanParams),
    supabaseRequest<Array<Pick<SupabaseOpportunityRow, 'payload'>>>(
      'vigie_opportunities',
      undefined,
      opportunityParams,
    ),
  ]);

  const storage = normalizeStorage({
    companies: companyRows.map((row) => row.payload),
    scans: scanRows.map((row) => row.payload),
    opportunities: opportunityRows.map((row) => row.payload),
  });
  memoryStorage = storage;
  return storage;
}

async function readStorage(): Promise<StorageShape> {
  if (isSupabaseConfigured()) {
    try {
      return await readStorageFromSupabase();
    } catch (error) {
      logSupabaseFallback(error, 'read');
      return readStorageFromFile();
    }
  }

  return readStorageFromFile();
}

async function writeStorage(payload: StorageShape) {
  memoryStorage = payload;

  if (!isSupabaseConfigured()) {
    writeStorageToFile(payload);
    return;
  }

  try {
    await Promise.all([
      payload.companies.length > 0
        ? supabaseRequest<SupabaseCompanyRow[]>(
            'vigie_companies',
            {
              method: 'POST',
              headers: {
                Prefer: 'resolution=merge-duplicates,return=minimal',
              },
              body: JSON.stringify(
                payload.companies.map((company) => ({
                  siren: company.siren,
                  payload: company,
                  website_url: company.websiteUrl,
                  email: company.email,
                  last_seen_at: company.lastSeenAt,
                  updated_at: new Date().toISOString(),
                })),
              ),
            },
            new URLSearchParams({ on_conflict: 'siren' }),
          )
        : Promise.resolve(null),
      payload.scans.length > 0
        ? supabaseRequest<SupabaseScanRow[]>(
            'vigie_scans',
            {
              method: 'POST',
              headers: {
                Prefer: 'resolution=merge-duplicates,return=minimal',
              },
              body: JSON.stringify(
                payload.scans.map((scan) => ({
                  id: scan.id,
                  siren: scan.siren,
                  company_name: scan.companyName,
                  website_url: scan.websiteUrl,
                  score: scan.score,
                  status: scan.status,
                  eligibility: scan.eligibility,
                  scanned_at: scan.scannedAt,
                  payload: scan,
                })),
              ),
            },
            new URLSearchParams({ on_conflict: 'id' }),
          )
        : Promise.resolve(null),
      payload.opportunities.length > 0
        ? supabaseRequest<SupabaseOpportunityRow[]>(
            'vigie_opportunities',
            {
              method: 'POST',
              headers: {
                Prefer: 'resolution=merge-duplicates,return=minimal',
              },
              body: JSON.stringify(
                payload.opportunities.map((opportunity) => ({
                  id: opportunity.id,
                  scan_id: opportunity.scanId,
                  siren: opportunity.siren,
                  lead_score: opportunity.scores.leadScore,
                  regulatory_urgency: opportunity.scores.regulatoryUrgency,
                  status: opportunity.status,
                  primary_offer: opportunity.recommendedOffer.primary,
                  payload: opportunity,
                  updated_at: opportunity.updatedAt,
                })),
              ),
            },
            new URLSearchParams({ on_conflict: 'id' }),
          )
        : Promise.resolve(null),
    ]);
  } catch (error) {
    logSupabaseFallback(error, 'write');
    writeStorageToFile(payload);
  }
}

function toCompanyRecord(company: CompanySearchResult): CompanyRecord {
  return {
    ...company,
    websiteUrl: null,
    websiteSource: 'inconnue',
    websiteConfidence: 'faible',
    websiteRedesignYear: null,
    websiteNotes: [],
    email: null,
    emailSource: 'inconnue',
    emailNotes: [],
    lastSeenAt: new Date().toISOString(),
    lastExportedAt: null,
  };
}

async function saveCompanyRecord(company: CompanyRecord) {
  const storage = await readStorage();
  const existing = storage.companies.filter((item) => item.siren !== company.siren);
  storage.companies = [company, ...existing]
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, 200);
  await writeStorage(storage);
  return company;
}

export async function upsertCompaniesFromSearch(companies: CompanySearchResult[]) {
  const storage = await readStorage();
  const now = new Date().toISOString();

  const bySiren = new Map(storage.companies.map((company) => [company.siren, company]));

  for (const company of companies) {
    const existing = bySiren.get(company.siren);
    if (existing) {
      bySiren.set(company.siren, {
        ...existing,
        ...company,
        lastSeenAt: now,
      });
    } else {
      bySiren.set(company.siren, {
        ...toCompanyRecord(company),
        lastSeenAt: now,
      });
    }
  }

  storage.companies = Array.from(bySiren.values())
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, 200);

  await writeStorage(storage);
  return storage.companies;
}

export async function setCompanyWebsite(siren: string, resolution: WebsiteResolution) {
  const company = await getCompanyFromStorage(siren);
  if (!company) {
    return null;
  }

  const updatedCompany = await saveCompanyRecord({
    ...company,
    websiteUrl: resolution.websiteUrl,
    websiteSource: resolution.source,
    websiteConfidence: resolution.confidence,
    websiteRedesignYear: resolution.websiteRedesignYear,
    websiteNotes: resolution.notes,
    lastSeenAt: new Date().toISOString(),
  });
  return updatedCompany;
}

export async function setCompanyEmail(
  siren: string,
  email: string | null,
  source: CompanyRecord['emailSource'],
  notes: string[],
) {
  const company = await getCompanyFromStorage(siren);
  if (!company) {
    return null;
  }

  const now = new Date().toISOString();
  const updatedCompany =
    email === company.email && source === company.emailSource
      ? { ...company, lastSeenAt: now }
      : {
          ...company,
          email,
          emailSource: source,
          emailNotes: notes,
          lastSeenAt: now,
        };

  return saveCompanyRecord(updatedCompany);
}

export async function getCompanyFromStorage(siren: string) {
  return (await readStorage()).companies.find((company) => company.siren === siren) ?? null;
}

export async function listCompanies(limit = 50) {
  return (await readStorage()).companies
    .slice()
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, limit);
}

export async function saveScan(scan: ScanRecord) {
  const storage = await readStorage();
  storage.scans = [scan, ...storage.scans.filter((item) => item.id !== scan.id)].slice(0, 40);
  await writeStorage(storage);
  return scan;
}

export async function getScanById(scanId: string) {
  return (await readStorage()).scans.find((scan) => scan.id === scanId) ?? null;
}

export async function listScans() {
  return (await readStorage()).scans;
}

export async function saveOpportunity(opportunity: OpportunityRecord) {
  const storage = await readStorage();
  const existing = storage.opportunities.filter((item) => item.id !== opportunity.id);
  storage.opportunities = [opportunity, ...existing].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  await writeStorage(storage);
  return opportunity;
}

export async function getOpportunityById(opportunityId: string) {
  return (
    (await readStorage()).opportunities.find((opportunity) => opportunity.id === opportunityId) ??
    null
  );
}

export async function getOpportunityByScanId(scanId: string) {
  return (
    (await readStorage()).opportunities.find((opportunity) => opportunity.scanId === scanId) ??
    null
  );
}

export async function listOpportunities() {
  return (await readStorage()).opportunities
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function setOpportunityStatus(opportunityId: string, status: OpportunityStatus) {
  const storage = await readStorage();
  const now = new Date().toISOString();
  storage.opportunities = storage.opportunities.map((opportunity) =>
    opportunity.id === opportunityId ? { ...opportunity, status, updatedAt: now } : opportunity,
  );
  await writeStorage(storage);
  return storage.opportunities.find((opportunity) => opportunity.id === opportunityId) ?? null;
}

export async function markOpportunitiesAsExported(opportunityIds: string[]) {
  const storage = await readStorage();
  const ids = new Set(opportunityIds);
  if (ids.size === 0) {
    return {
      opportunities: storage.opportunities,
      companies: storage.companies,
      exportedAt: null,
    };
  }

  const exportedAt = new Date().toISOString();
  const impactedSirens = new Set<string>();

  storage.opportunities = storage.opportunities.map((opportunity) => {
    if (!ids.has(opportunity.id)) {
      return opportunity;
    }

    impactedSirens.add(opportunity.siren);
    return {
      ...opportunity,
      lastExportedAt: exportedAt,
      updatedAt: exportedAt,
    };
  });

  storage.companies = storage.companies.map((company) =>
    impactedSirens.has(company.siren)
      ? {
          ...company,
          lastExportedAt: exportedAt,
          lastSeenAt: exportedAt,
        }
      : company,
  );

  await writeStorage(storage);

  return {
    opportunities: storage.opportunities.filter((opportunity) => ids.has(opportunity.id)),
    companies: storage.companies.filter((company) => impactedSirens.has(company.siren)),
    exportedAt,
  };
}

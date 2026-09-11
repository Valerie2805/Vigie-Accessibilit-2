import type { Company } from '@/types';

const STORAGE_KEY = 'vigie-accessibilite-recent-companies';
const MAX_COMPANIES = 200;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeCompany(company: Company, seenAt: string): Company {
  return {
    ...company,
    websiteUrl: company.websiteUrl ?? null,
    websiteSource: company.websiteSource ?? 'inconnue',
    websiteConfidence: company.websiteConfidence ?? 'faible',
    websiteRedesignYear: company.websiteRedesignYear ?? null,
    email: company.email ?? null,
    lastSeenAt: company.lastSeenAt ?? seenAt,
    latestScanStatus: company.latestScanStatus ?? null,
    latestScannedAt: company.latestScannedAt ?? null,
  };
}

function mergeCompany(existing: Company | undefined, incoming: Company, seenAt: string): Company {
  const normalizedIncoming = normalizeCompany(incoming, seenAt);

  if (!existing) {
    return normalizedIncoming;
  }

  return {
    ...existing,
    ...normalizedIncoming,
    activite: normalizedIncoming.activite ?? existing.activite,
    adresse: normalizedIncoming.adresse ?? existing.adresse,
    chiffreAffaires: normalizedIncoming.chiffreAffaires ?? existing.chiffreAffaires,
    codePostal: normalizedIncoming.codePostal ?? existing.codePostal,
    categorieEntreprise: normalizedIncoming.categorieEntreprise ?? existing.categorieEntreprise,
    email: normalizedIncoming.email ?? existing.email,
    latestScanStatus: normalizedIncoming.latestScanStatus ?? existing.latestScanStatus ?? null,
    latestScannedAt: normalizedIncoming.latestScannedAt ?? existing.latestScannedAt ?? null,
    lastSeenAt: normalizedIncoming.lastSeenAt ?? existing.lastSeenAt ?? seenAt,
    trancheEffectif: normalizedIncoming.trancheEffectif ?? existing.trancheEffectif,
    ville: normalizedIncoming.ville ?? existing.ville,
    websiteRedesignYear:
      normalizedIncoming.websiteRedesignYear ?? existing.websiteRedesignYear ?? null,
    websiteConfidence: normalizedIncoming.websiteUrl
      ? normalizedIncoming.websiteConfidence
      : existing.websiteConfidence,
    websiteSource: normalizedIncoming.websiteUrl
      ? normalizedIncoming.websiteSource
      : existing.websiteSource,
    websiteUrl: normalizedIncoming.websiteUrl ?? existing.websiteUrl,
  };
}

export function mergeRecentCompanies(...companyLists: Company[][]) {
  const merged = new Map<string, Company>();

  for (const list of companyLists) {
    for (const company of list) {
      const seenAt = company.lastSeenAt ?? new Date().toISOString();
      merged.set(
        company.siren,
        mergeCompany(merged.get(company.siren), company, seenAt),
      );
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''))
    .slice(0, MAX_COMPANIES);
}

export function readRecentCompaniesFromBrowser() {
  if (!canUseStorage()) {
    return [] as Company[];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Company[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return mergeRecentCompanies(parsed);
  } catch {
    return [];
  }
}

export function saveRecentCompaniesToBrowser(companies: Company[]) {
  if (!canUseStorage()) {
    return;
  }

  try {
    const merged = mergeRecentCompanies(readRecentCompaniesFromBrowser(), companies);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore storage failures to avoid blocking the UI.
  }
}
import type {
  Company,
  Opportunity,
  OpportunityStatus,
  Scan,
  WebsiteResolution,
} from '@/types';

async function request<T>(input: string, init?: RequestInit) {
  let response: Response;

  try {
    response = await fetch(input, {
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      ...init,
    });
  } catch (error) {
    throw new Error(
      error instanceof Error &&
        /fetch failed|failed to fetch|networkerror|load failed/i.test(error.message)
        ? "Connexion au service impossible pour le moment. Verifie que l'API est bien disponible puis reessaie."
        : "Une erreur reseau est survenue. Reessaie dans quelques instants.",
    );
  }

  const raw = await response.text();
  let payload: Record<string, unknown> = {};

  try {
    payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`Erreur serveur (${response.status})`);
    }
  }

  if (!response.ok || payload.success === false) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : `Une erreur est survenue (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function searchCompanies(
  query?: string,
  city?: string,
  department?: string,
  metier?: string,
  nafCode?: string,
  minRevenue?: number,
  maxRevenue?: number,
  minEmployees?: number,
  maxEmployees?: number,
) {
  const url = new URL('/api/companies/search', window.location.origin);
  if (query?.trim()) {
    url.searchParams.set('q', query.trim());
  }
  if (city?.trim()) {
    url.searchParams.set('city', city.trim());
  }
  if (department?.trim()) {
    url.searchParams.set('department', department.trim());
  }
  if (metier?.trim()) {
    url.searchParams.set('metier', metier.trim());
  }
  if (nafCode?.trim()) {
    url.searchParams.set('nafCode', nafCode.trim());
  }
  if (typeof minRevenue === 'number' && !Number.isNaN(minRevenue)) {
    url.searchParams.set('minRevenue', String(minRevenue));
  }
  if (typeof maxRevenue === 'number' && !Number.isNaN(maxRevenue)) {
    url.searchParams.set('maxRevenue', String(maxRevenue));
  }
  if (typeof minEmployees === 'number' && !Number.isNaN(minEmployees)) {
    url.searchParams.set('minEmployees', String(minEmployees));
  }
  if (typeof maxEmployees === 'number' && !Number.isNaN(maxEmployees)) {
    url.searchParams.set('maxEmployees', String(maxEmployees));
  }

  return request<{ results: Company[] }>(url.toString());
}

export async function getCompany(siren: string) {
  return request<{ company: Company }>(`/api/companies/${siren}`);
}

export async function resolveWebsite(siren: string, manualWebsite?: string) {
  return request<{ company: Company; resolution: WebsiteResolution }>(
    '/api/companies/resolve-website',
    {
      method: 'POST',
      body: JSON.stringify({
        siren,
        manualWebsite: manualWebsite?.trim() || '',
      }),
    },
  );
}

export async function createScan(siren: string, websiteUrl?: string) {
  return request<{ scan: Scan; opportunity: Opportunity | null; resolution: WebsiteResolution }>('/api/scans', {
    method: 'POST',
    body: JSON.stringify({
      siren,
      websiteUrl: websiteUrl?.trim() || '',
    }),
  });
}

export async function createAxeScan(siren: string, websiteUrl?: string) {
  return request<{ scan: Scan; resolution: WebsiteResolution }>('/api/scans/axe', {
    method: 'POST',
    body: JSON.stringify({
      siren,
      websiteUrl: websiteUrl?.trim() || '',
    }),
  });
}

export async function getScan(scanId: string) {
  return request<{ scan: Scan }>(`/api/scans/${scanId}`);
}

export async function listScans() {
  return request<{ scans: Scan[] }>('/api/scans');
}

export async function listRecentCompanies(limit?: number) {
  const url = new URL('/api/companies/recent', window.location.origin);
  if (typeof limit === 'number' && !Number.isNaN(limit)) {
    url.searchParams.set('limit', String(limit));
  }

  return request<{ companies: Company[] }>(url.toString());
}

export async function listOpportunities() {
  return request<{ opportunities: Opportunity[] }>('/api/opportunities');
}

export async function getOpportunity(opportunityId: string) {
  return request<{ opportunity: Opportunity }>(`/api/opportunities/${opportunityId}`);
}

export async function recomputeOpportunity(opportunityId: string) {
  return request<{ opportunity: Opportunity }>(`/api/opportunities/${opportunityId}/recompute`, {
    method: 'POST',
  });
}

export async function regenerateOpportunityOutreach(opportunityId: string) {
  return request<{ opportunity: Opportunity }>(
    `/api/opportunities/${opportunityId}/generate-outreach`,
    {
      method: 'POST',
    },
  );
}

export async function updateOpportunityStatus(opportunityId: string, status: OpportunityStatus) {
  return request<{ opportunity: Opportunity }>(`/api/opportunities/${opportunityId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function registerOpportunityExport(ids: string[], format: 'csv' | 'xls') {
  return request<{ opportunities: Opportunity[]; exportedAt: string | null }>(
    '/api/opportunities/export',
    {
      method: 'POST',
      body: JSON.stringify({ ids, format }),
    },
  );
}

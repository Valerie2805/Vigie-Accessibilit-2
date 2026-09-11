const snovEmailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

type SnovEmailResolution = {
  email: string | null;
  emails: string[];
  notes: string[];
};

type SnovEmailCandidate = {
  email: string;
  sourceType: 'prospect' | 'generic' | 'domain';
  position?: string;
  firstName?: string;
  lastName?: string;
};

type SnovProspect = {
  first_name?: string;
  last_name?: string;
  position?: string;
  search_emails_start?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function getDomainFromWebsite(websiteUrl: string) {
  try {
    const parsed = new URL(websiteUrl);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

function scoreEmail(email: string, domain: string) {
  const [localPart, emailDomain] = normalizeEmail(email).split('@');
  if (!localPart || !emailDomain || emailDomain !== domain) {
    return -100;
  }

  let score = 0;

  if (/^(contact|info|hello|bonjour|commercial|sales|support|serviceclient|service-client)$/.test(localPart)) {
    score += 10;
  }

  if (/^(admin|office|team|communication|marketing)$/.test(localPart)) {
    score += 6;
  }

  if (/^(no-?reply|noreply|do-?not-?reply)$/.test(localPart)) {
    score -= 10;
  }

  if (localPart.length <= 3) {
    score -= 1;
  }

  return score;
}

function hasExecutivePosition(position?: string) {
  const normalized = (position ?? '').toLowerCase();
  return /pdg|ceo|chief executive officer|president|président|founder|fondateur|cofondateur|co-founder|gerant|gérant|managing director|directeur general|directeur général|owner|dirigeant/.test(
    normalized,
  );
}

function isGenericEmail(localPart: string) {
  return /^(contact|info|hello|bonjour|commercial|sales|support|serviceclient|service-client|admin|office|team|communication|marketing)$/.test(
    localPart,
  );
}

function isLikelyPersonalEmail(localPart: string) {
  return /^[a-z0-9._-]+$/.test(localPart) && !isGenericEmail(localPart);
}

function scoreEmailCandidate(candidate: SnovEmailCandidate, domain: string) {
  const normalizedEmail = normalizeEmail(candidate.email);
  const [localPart, emailDomain] = normalizedEmail.split('@');
  if (!localPart || !emailDomain || emailDomain !== domain) {
    return -100;
  }

  let score = scoreEmail(normalizedEmail, domain);

  if (candidate.sourceType === 'prospect') {
    score += 20;
  }

  if (candidate.sourceType === 'domain') {
    score += 4;
  }

  if (candidate.sourceType === 'generic') {
    score -= 8;
  }

  if (hasExecutivePosition(candidate.position)) {
    score += 80;
  }

  if (candidate.position && /director|directeur|head|responsable|manager|managere?/.test(candidate.position.toLowerCase())) {
    score += 18;
  }

  if (isLikelyPersonalEmail(localPart)) {
    score += 14;
  }

  if (candidate.firstName || candidate.lastName) {
    score += 6;
  }

  return score;
}

function pickBestEmail(candidates: SnovEmailCandidate[], domain: string) {
  const deduped = Array.from(
    new Map(
      candidates.map((candidate) => [normalizeEmail(candidate.email), candidate]),
    ).values(),
  );

  const ranked = deduped
    .map((candidate) => ({
      email: normalizeEmail(candidate.email),
      score: scoreEmailCandidate(candidate, domain),
      candidate,
    }))
    .filter((entry) => entry.score > -100)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.candidate ?? null;
}

function extractTaskHash(payload: Record<string, unknown>) {
  const taskHash =
    (typeof payload.task_hash === 'string' ? payload.task_hash : null) ??
    (payload.meta &&
    typeof payload.meta === 'object' &&
    'task_hash' in payload.meta &&
    typeof payload.meta.task_hash === 'string'
      ? payload.meta.task_hash
      : null);

  if (taskHash) {
    return taskHash;
  }

  const resultLink =
    payload.links &&
    typeof payload.links === 'object' &&
    'result' in payload.links &&
    typeof payload.links.result === 'string'
      ? payload.links.result
      : null;

  if (!resultLink) {
    return null;
  }

  const match = resultLink.match(/\/([a-f0-9]{16,})$/i);
  return match?.[1] ?? null;
}

function extractResultLink(payload: Record<string, unknown>) {
  if (
    payload.links &&
    typeof payload.links === 'object' &&
    'result' in payload.links &&
    typeof payload.links.result === 'string'
  ) {
    return payload.links.result;
  }

  return null;
}

function extractEmailsDeep(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    return (value.match(snovEmailPattern) ?? []).map(normalizeEmail);
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractEmailsDeep(entry));
  }

  if (typeof value === 'object') {
    return Object.values(value).flatMap((entry) => extractEmailsDeep(entry));
  }

  return [];
}

async function getAccessToken() {
  const clientId = process.env.SNOV_API_USER_ID;
  const clientSecret = process.env.SNOV_API_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch('https://api.snov.io/v1/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Authentification Snov.io impossible (${response.status})`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return typeof payload.access_token === 'string' ? payload.access_token : null;
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDomainTask(
  token: string,
  startUrl: string,
  resultBaseUrl: string,
  domain: string,
  sourceType: 'generic' | 'domain',
) {
  const requestUrl = new URL(startUrl);
  requestUrl.searchParams.set('domain', domain);

  const startResponse = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!startResponse.ok) {
    throw new Error(`Recherche Snov.io impossible (${startResponse.status})`);
  }

  const startPayload = (await startResponse.json()) as Record<string, unknown>;
  const taskHash = extractTaskHash(startPayload);
  if (!taskHash) {
    throw new Error('Snov.io n a pas renvoye de task_hash');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const resultResponse = await fetch(`${resultBaseUrl}/${taskHash}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resultResponse.ok) {
      throw new Error(`Lecture du resultat Snov.io impossible (${resultResponse.status})`);
    }

    const resultPayload = (await resultResponse.json()) as Record<string, unknown>;
    const status = typeof resultPayload.status === 'string' ? resultPayload.status : '';
    const emails = uniq(extractEmailsDeep(resultPayload.data));

    if (emails.length > 0) {
      return emails.map((email) => ({
        email,
        sourceType,
      })) as SnovEmailCandidate[];
    }

    if (status === 'completed') {
      return [] as SnovEmailCandidate[];
    }

    await wait(800);
  }

  return [] as SnovEmailCandidate[];
}

async function fetchTaskEmails(token: string, resultUrl: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetch(resultUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Lecture du resultat Snov.io impossible (${response.status})`);
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const status = typeof payload.status === 'string' ? payload.status : '';
    const emails = uniq(extractEmailsDeep(payload.data));

    if (emails.length > 0) {
      return emails;
    }

    if (status === 'completed') {
      return [];
    }

    await wait(800);
  }

  return [];
}

async function runProspectEmailTask(token: string, startUrl: string, prospect: SnovProspect) {
  const response = await fetch(startUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Recherche email prospect Snov.io impossible (${response.status})`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const inlineEmails = uniq(extractEmailsDeep(payload.data));
  if (inlineEmails.length > 0) {
    return inlineEmails.map((email) => ({
      email,
      sourceType: 'prospect',
      position: prospect.position,
      firstName: prospect.first_name,
      lastName: prospect.last_name,
    })) as SnovEmailCandidate[];
  }

  const resultLink = extractResultLink(payload);
  if (resultLink) {
    const emails = await fetchTaskEmails(token, resultLink);
    return emails.map((email) => ({
      email,
      sourceType: 'prospect',
      position: prospect.position,
      firstName: prospect.first_name,
      lastName: prospect.last_name,
    })) as SnovEmailCandidate[];
  }

  const taskHash = extractTaskHash(payload);
  if (taskHash) {
    const emails = await fetchTaskEmails(
      token,
      `https://api.snov.io/v2/domain-search/prospects/search-emails/result/${taskHash}`,
    );
    return emails.map((email) => ({
      email,
      sourceType: 'prospect',
      position: prospect.position,
      firstName: prospect.first_name,
      lastName: prospect.last_name,
    })) as SnovEmailCandidate[];
  }

  return [] as SnovEmailCandidate[];
}

async function searchProspectEmails(token: string, domain: string) {
  const requestUrl = new URL('https://api.snov.io/v2/domain-search/prospects/start');
  requestUrl.searchParams.set('domain', domain);
  requestUrl.searchParams.set('page', '1');

  const startResponse = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!startResponse.ok) {
    throw new Error(`Recherche prospects Snov.io impossible (${startResponse.status})`);
  }

  const startPayload = (await startResponse.json()) as Record<string, unknown>;
  const resultLink =
    extractResultLink(startPayload) ??
    (() => {
      const taskHash = extractTaskHash(startPayload);
      return taskHash
        ? `https://api.snov.io/v2/domain-search/prospects/result/${taskHash}`
        : null;
    })();

  if (!resultLink) {
    return [];
  }

  const resultResponse = await fetch(resultLink, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!resultResponse.ok) {
    throw new Error(`Lecture prospects Snov.io impossible (${resultResponse.status})`);
  }

  const resultPayload = (await resultResponse.json()) as Record<string, unknown>;
  const prospects = Array.isArray(resultPayload.data)
    ? (resultPayload.data as SnovProspect[])
    : [];

  const candidates: SnovEmailCandidate[] = [];

  for (const prospect of prospects.slice(0, 10)) {
    if (!prospect.search_emails_start) {
      continue;
    }

    const prospectEmails = await runProspectEmailTask(
      token,
      prospect.search_emails_start,
      prospect,
    );
    candidates.push(...prospectEmails);
  }

  return candidates;
}

export async function findCompanyEmailsWithSnov(websiteUrl: string): Promise<SnovEmailResolution> {
  const domain = getDomainFromWebsite(websiteUrl);
  if (!domain) {
    return {
      email: null,
      emails: [],
      notes: ['Domaine Snov.io invalide'],
    };
  }

  if (!process.env.SNOV_API_USER_ID || !process.env.SNOV_API_SECRET) {
    return {
      email: null,
      emails: [],
      notes: ['Snov.io non configure dans les variables d environnement'],
    };
  }

  const notes: string[] = [];

  try {
    const token = await getAccessToken();
    if (!token) {
      return {
        email: null,
        emails: [],
        notes: ['Jeton Snov.io introuvable'],
      };
    }

    const prospectEmails = await searchProspectEmails(token, domain);
    const domainEmails = await runDomainTask(
      token,
      'https://api.snov.io/v2/domain-search/domain-emails/start',
      'https://api.snov.io/v2/domain-search/domain-emails/result',
      domain,
      'domain',
    );

    const genericEmails = await runDomainTask(
      token,
      'https://api.snov.io/v2/domain-search/generic-contacts/start',
      'https://api.snov.io/v2/domain-search/generic-contacts/result',
      domain,
      'generic',
    );

    const candidates = [...prospectEmails, ...genericEmails, ...domainEmails].filter((candidate) =>
      normalizeEmail(candidate.email).endsWith(`@${domain}`),
    );
    const bestCandidate = pickBestEmail(candidates, domain);
    const emails = uniq(candidates.map((candidate) => normalizeEmail(candidate.email)));

    return {
      email: bestCandidate?.email ?? null,
      emails,
      notes:
        emails.length > 0
          ? [
              hasExecutivePosition(bestCandidate?.position)
                ? 'Email de dirigeant priorise via Snov.io'
                : bestCandidate?.sourceType === 'prospect'
                  ? 'Email prospect priorise via Snov.io'
                  : 'Email trouve via Snov.io',
            ]
          : ['Snov.io n a retourne aucun email sur ce domaine'],
    };
  } catch (error) {
    notes.push(
      error instanceof Error ? error.message : 'Erreur inconnue Snov.io',
    );

    return {
      email: null,
      emails: [],
      notes,
    };
  }
}

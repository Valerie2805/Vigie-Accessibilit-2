import type { CompanySearchResult, WebsiteResolution } from '../types.js';
import * as cheerio from 'cheerio';

type FindPlaceResponse = {
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
  }>;
  status?: string;
};

type PlaceDetailsResponse = {
  result?: {
    website?: string;
    url?: string;
    name?: string;
  };
  status?: string;
};

type SearchCandidate = {
  url: string;
  title: string;
  snippet: string;
};

type SearchProvider = 'duckduckgo' | 'bing';
type CandidateValidation = {
  websiteUrl: string | null;
  score: number;
};

const ignoredHosts = [
  'annuaire-entreprises.data.gouv.fr',
  'annuaire-entreprises.gouv.fr',
  'www.societe.com',
  'societe.com',
  'www.pappers.fr',
  'pappers.fr',
  'www.pple.fr',
  'pple.fr',
  'www.infonet.fr',
  'infonet.fr',
  'www.manageo.fr',
  'manageo.fr',
  'www.verif.com',
  'verif.com',
  'fr.linkedin.com',
  'linkedin.com',
  'www.linkedin.com',
  'facebook.com',
  'www.facebook.com',
  'instagram.com',
  'www.instagram.com',
  'x.com',
  'www.x.com',
  'maps.google.com',
  'www.google.com',
  'pagesjaunes.fr',
  'www.pagesjaunes.fr',
  'hotelplanner.com',
  'www.hotelplanner.com',
  'rne-entreprise.fr',
  'www.rne-entreprise.fr',
  'e-pro.fr',
  'www.e-pro.fr',
  'hoodspot.fr',
  'www.hoodspot.fr',
  'europages.fr',
  'www.europages.fr',
  'kompass.com',
  'fr.kompass.com',
  'gralon.net',
  'www.gralon.net',
  'booking.com',
  'www.booking.com',
  'tripadvisor.fr',
  'www.tripadvisor.fr',
  'tripadvisor.com',
  'www.tripadvisor.com',
  'infobel.com',
  'www.infobel.com',
  'cylex-locale.fr',
  'www.cylex-locale.fr',
  'petitfute.com',
  'www.petitfute.com',
  '118000.fr',
  'www.118000.fr',
];

const genericTokens = new Set([
  'societe',
  'societes',
  'entreprise',
  'entreprises',
  'groupe',
  'travaux',
  'publics',
  'public',
  'service',
  'services',
  'france',
  'batiment',
  'construction',
  'compagnie',
  'agence',
  'holding',
]);
const ignoredSlugTokens = new Set([
  'france',
  'groupe',
  'group',
  'societe',
  'entreprise',
  'entreprises',
  'services',
  'service',
  'sas',
  'sasu',
  'sarl',
  'sa',
  'eurl',
  'sci',
]);
const minimumRelevantYear = 2000;
const likelyDirectoryPattern =
  /\b(annuaire|fiche entreprise|societe|siret|siren|pages jaunes|telephone|tel\.?|horaires|avis|reservation|booking|tripadvisor|comparateur|itineraire)\b/i;

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenizeCompanyName(companyName: string) {
  return normalizeText(companyName)
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 3)
    .filter((token) => !genericTokens.has(token));
}

function countTokenMatches(tokens: string[], text: string) {
  return tokens.filter((token) => text.includes(token)).length;
}

function buildCompanyNameSlugs(companyName: string) {
  const words = normalizeText(companyName)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

  const compactLetters = normalizeText(companyName).replace(/[^a-z0-9]/g, '');
  const compactWords = words.filter((word) => !ignoredSlugTokens.has(word));
  const significantTokens = tokenizeCompanyName(companyName);
  const slugs = new Set<string>();

  if (compactLetters.length >= 4) {
    slugs.add(compactLetters);
  }

  const fullSlug = words.join('');
  if (fullSlug.length >= 4) {
    slugs.add(fullSlug);
  }

  const compactSlug = compactWords.join('');
  if (compactSlug.length >= 4) {
    slugs.add(compactSlug);
  }

  const significantSlug = significantTokens.join('');
  if (significantSlug.length >= 4) {
    slugs.add(significantSlug);
  }

  if (compactWords.length >= 2) {
    slugs.add(compactWords.slice(-2).join(''));
  }

  if (compactWords.length >= 1 && compactWords[0].length <= 4) {
    slugs.add(`${compactWords[0]}groupe`);
  }

  const hotelWord = compactWords.find((word) => word === 'hotel' || word === 'hotels');
  const initials = words.filter((word) => word.length === 1).join('');
  if (hotelWord && initials.length >= 2) {
    slugs.add(`${hotelWord}${initials}`);
    slugs.add(`${initials}${hotelWord}`);
    slugs.add(`${initials}${hotelWord}s`);
  }

  return Array.from(slugs).filter((slug) => slug.length >= 4);
}

function isIgnoredHost(host: string) {
  return ignoredHosts.some((ignoredHost) => host === ignoredHost || host.endsWith(`.${ignoredHost}`));
}

function parseSearchResultUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'https://duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    if (redirected) {
      return decodeURIComponent(redirected);
    }

    if (parsed.hostname.endsWith('bing.com') && parsed.pathname.startsWith('/ck/a')) {
      const encodedTarget = parsed.searchParams.get('u');
      if (encodedTarget) {
        const normalizedTarget = encodedTarget.startsWith('a1')
          ? encodedTarget.slice(2)
          : encodedTarget;

        try {
          const decodedTarget = Buffer.from(normalizedTarget, 'base64').toString('utf-8');
          if (decodedTarget.startsWith('http://') || decodedTarget.startsWith('https://')) {
            return decodedTarget;
          }
        } catch {
          // Ignore invalid Bing redirect payloads.
        }
      }
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function toWebsiteRoot(url: string) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function extractDuckDuckGoSearchCandidates(html: string) {
  const $ = cheerio.load(html);
  const results: SearchCandidate[] = [];

  $('a.result__a, a[data-testid="result-title-a"], .result a[href], .links_main a[href]')
    .slice(0, 12)
    .each((_, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();
      const snippet =
        $(element).closest('.result, .web-result').find('.result__snippet, .result__extras').text().trim() ??
        '';

      if (!href || !title) {
        return;
      }

      const parsedUrl = parseSearchResultUrl(href);
      results.push({
        url: parsedUrl,
        title,
        snippet,
      });
    });

  return results;
}

function extractBingSearchCandidates(html: string) {
  const $ = cheerio.load(html);
  const results: SearchCandidate[] = [];

  $('li.b_algo').slice(0, 10).each((_, element) => {
    const link = $(element).find('h2 a').first();
    const href = link.attr('href');
    const title = link.text().trim();
    const snippet =
      $(element).find('.b_caption p, .b_snippet, p').first().text().trim() ?? '';

    if (!href || !title) {
      return;
    }

    results.push({
      url: parseSearchResultUrl(href),
      title,
      snippet,
    });
  });

  return results;
}

function extractSearchCandidates(html: string, provider: SearchProvider) {
  const extracted =
    provider === 'bing'
      ? extractBingSearchCandidates(html)
      : extractDuckDuckGoSearchCandidates(html);

  return Array.from(
    new Map(
      extracted.map((candidate) => [
        `${candidate.url}::${candidate.title}`,
        candidate,
      ]),
    ).values(),
  );
}

function buildSearchQueries(company: CompanySearchResult) {
  return [
    [company.nom, company.ville, company.codePostal].filter(Boolean).join(' '),
    `"${company.nom}" site officiel`,
    `"${company.nom}" ${company.ville ?? ''}`.trim(),
  ].filter(Boolean);
}

async function searchWebCandidates(company: CompanySearchResult) {
  const candidates: SearchCandidate[] = [];
  const providers: Array<{ name: SearchProvider; buildUrl: (query: string) => URL }> = [
    {
      name: 'duckduckgo',
      buildUrl: (query) => {
        const url = new URL('https://html.duckduckgo.com/html/');
        url.searchParams.set('q', query);
        return url;
      },
    },
    {
      name: 'bing',
      buildUrl: (query) => {
        const url = new URL('https://www.bing.com/search');
        url.searchParams.set('q', query);
        url.searchParams.set('cc', 'fr');
        url.searchParams.set('setlang', 'fr');
        return url;
      },
    },
  ];

  for (const query of buildSearchQueries(company)) {
    for (const provider of providers) {
      try {
        const response = await fetch(provider.buildUrl(query), {
          headers: {
            'User-Agent': 'TraeAccessibilityMvp/0.1',
            accept: 'text/html,application/xhtml+xml',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
          continue;
        }

        const html = await response.text();
        const providerCandidates = extractSearchCandidates(html, provider.name);
        candidates.push(...providerCandidates);
      } catch {
        continue;
      }

      if (candidates.length >= 5) {
        break;
      }
    }

    if (candidates.length >= 5) {
      break;
    }
  }

  return Array.from(
    new Map(candidates.map((candidate) => [candidate.url, candidate])).values(),
  );
}

function scoreCandidate(company: CompanySearchResult, candidate: SearchCandidate) {
  const tokens = tokenizeCompanyName(company.nom);
  const titleAndSnippet = normalizeText(`${candidate.title} ${candidate.snippet}`);
  const url = normalizeWebsite(candidate.url);

  try {
    const host = new URL(url).host.toLowerCase();
    if (isIgnoredHost(host)) {
      return -100;
    }

    let score = 0;
    const root = toWebsiteRoot(url);
    if (root) {
      score += 1;
    }

    for (const token of tokens) {
      if (host.includes(token)) {
        score += 4;
      }
      if (titleAndSnippet.includes(token)) {
        score += 2;
      }
    }

    const normalizedCity = company.ville ? normalizeText(company.ville) : '';
    if (normalizedCity && titleAndSnippet.includes(normalizedCity)) {
      score += 1;
    }

    if (/site officiel|contact|accueil|groupe/.test(titleAndSnippet)) {
      score += 1;
    }

    return score;
  } catch {
    return -100;
  }
}

async function resolveWithWebSearch(company: CompanySearchResult) {
  const candidates = await searchWebCandidates(company);
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(company, candidate),
    }))
    .filter((entry) => entry.score >= 3)
    .sort((a, b) => b.score - a.score);

  for (const entry of ranked.slice(0, 5)) {
    const validated = await validateCandidateWebsite(company, entry.candidate, entry.score);
    if (validated.websiteUrl) {
      return validated.websiteUrl;
    }
  }

  return null;
}

async function resolveWithGooglePlaces(company: CompanySearchResult) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return null;
  }

  const query = [company.nom, company.ville, company.codePostal].filter(Boolean).join(' ');
  const findPlaceUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  findPlaceUrl.searchParams.set('input', query);
  findPlaceUrl.searchParams.set('inputtype', 'textquery');
  findPlaceUrl.searchParams.set('fields', 'place_id,name,formatted_address');
  findPlaceUrl.searchParams.set('key', apiKey);

  const placeResponse = await fetch(findPlaceUrl);
  if (!placeResponse.ok) {
    return null;
  }

  const placePayload = (await placeResponse.json()) as FindPlaceResponse;
  const placeId = placePayload.candidates?.[0]?.place_id;
  if (!placeId) {
    return null;
  }

  const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  detailsUrl.searchParams.set('place_id', placeId);
  detailsUrl.searchParams.set('fields', 'website,url,name');
  detailsUrl.searchParams.set('key', apiKey);

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) {
    return null;
  }

  const detailsPayload = (await detailsResponse.json()) as PlaceDetailsResponse;
  return detailsPayload.result?.website ?? null;
}

function normalizeWebsite(url: string) {
  try {
    const parsedUrl = new URL(url);
    parsedUrl.hash = '';
    parsedUrl.search = '';
    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

async function validateCandidateWebsite(
  company: CompanySearchResult,
  candidate: SearchCandidate,
  baseScore: number,
): Promise<CandidateValidation> {
  const candidateRoot = toWebsiteRoot(candidate.url);
  if (!candidateRoot) {
    return { websiteUrl: null, score: -100 };
  }

  try {
    const response = await fetch(candidateRoot, {
      headers: {
        'User-Agent': 'TraeAccessibilityMvp/0.1',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return { websiteUrl: null, score: -100 };
    }

    const finalUrl = toWebsiteRoot(response.url || candidateRoot) ?? candidateRoot;
    const finalHost = new URL(finalUrl).host.toLowerCase();
    if (isIgnoredHost(finalHost)) {
      return { websiteUrl: null, score: -100 };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      return { websiteUrl: null, score: -100 };
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const normalizedTitle = normalizeText($('title').text());
    const normalizedMeta = normalizeText(
      [
        $('meta[property="og:site_name"]').attr('content') ?? '',
        $('meta[name="application-name"]').attr('content') ?? '',
        $('meta[name="description"]').attr('content') ?? '',
      ].join(' '),
    );
    const normalizedBody = normalizeText($('body').text().slice(0, 6000));
    const normalizedCombined = `${normalizedTitle} ${normalizedMeta} ${normalizedBody}`.trim();
    const normalizedCompanyName = normalizeText(company.nom);
    const tokens = tokenizeCompanyName(company.nom);
    const companySlugs = buildCompanyNameSlugs(company.nom);
    const hostMatchCount = countTokenMatches(tokens, normalizeText(finalHost));
    const bodyMatchCount = countTokenMatches(tokens, normalizedCombined);
    const compactHost = normalizeText(finalHost).replace(/[^a-z0-9]/g, '');
    const compactCombined = normalizedCombined.replace(/[^a-z0-9]/g, '');
    const slugMatchCount = companySlugs.filter(
      (slug) => compactHost.includes(slug) || compactCombined.includes(slug),
    ).length;

    let score = baseScore;

    if (normalizedCombined.includes(normalizedCompanyName)) {
      score += 8;
    }

    score += hostMatchCount * 4;
    score += Math.min(bodyMatchCount, 4) * 2;
    score += slugMatchCount * 5;

    const normalizedCity = company.ville ? normalizeText(company.ville) : '';
    if (normalizedCity && normalizedCombined.includes(normalizedCity)) {
      score += 2;
    }

    if (/contact|mentions legales|qui sommes nous|accueil|site officiel/.test(normalizedCombined)) {
      score += 1;
    }

    if (likelyDirectoryPattern.test(normalizedCombined)) {
      score -= 6;
    }

    const minimumBodyMatches = tokens.length >= 2 ? 2 : 1;
    const hasStrongMatch =
      hostMatchCount >= 1 ||
      slugMatchCount >= 1 ||
      normalizedCombined.includes(normalizedCompanyName) ||
      bodyMatchCount >= minimumBodyMatches;

    if (!hasStrongMatch || score < 6) {
      return { websiteUrl: null, score };
    }

    return {
      websiteUrl: finalUrl,
      score,
    };
  } catch {
    return { websiteUrl: null, score: -100 };
  }
}

function buildWebsiteGuesses(company: CompanySearchResult) {
  const guesses: string[] = [];
  const slugs = buildCompanyNameSlugs(company.nom).slice(0, 5);
  const tlds = ['fr', 'com', 'eu'];

  for (const slug of slugs) {
    for (const tld of tlds) {
      guesses.push(`https://www.${slug}.${tld}`);
      guesses.push(`https://${slug}.${tld}`);
      guesses.push(`https://www.${slug}-groupe.${tld}`);
      guesses.push(`https://${slug}-groupe.${tld}`);
      guesses.push(`https://www.groupe-${slug}.${tld}`);
      guesses.push(`https://groupe-${slug}.${tld}`);
    }
  }

  return Array.from(new Set(guesses));
}

async function resolveWithGuessedDomains(company: CompanySearchResult) {
  for (const guessedUrl of buildWebsiteGuesses(company)) {
    const validated = await validateCandidateWebsite(
      company,
      { url: guessedUrl, title: '', snippet: '' },
      0,
    );
    if (validated.websiteUrl) {
      return validated.websiteUrl;
    }
  }

  return null;
}

function isValidRelevantYear(year: number) {
  return year >= minimumRelevantYear && year <= new Date().getFullYear() + 1;
}

function extractYearFromDate(rawValue: string | null | undefined) {
  if (!rawValue) {
    return null;
  }

  const parsed = new Date(rawValue);
  const year = parsed.getUTCFullYear();
  return Number.isNaN(year) || !isValidRelevantYear(year) ? null : year;
}

function collectYearMatches(rawValue: string) {
  return Array.from(rawValue.matchAll(/\b(19\d{2}|20\d{2})\b/g))
    .map((match) => Number(match[1]))
    .filter((year) => isValidRelevantYear(year));
}

function getBestYearFromText(rawValue: string) {
  const years = collectYearMatches(rawValue);
  if (years.length === 0) {
    return null;
  }

  return Math.max(...years);
}

function collectJsonDateHints(
  value: unknown,
  hints: Array<{ year: number; confidence: number; source: string }>,
) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonDateHints(item, hints);
    }
    return;
  }

  if (typeof value !== 'object') {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (typeof nestedValue === 'string') {
      const lowerKey = key.toLowerCase();
      const exactYear = extractYearFromDate(nestedValue);
      if (exactYear !== null) {
        if (lowerKey.includes('modified') || lowerKey.includes('updated')) {
          hints.push({ year: exactYear, confidence: 4, source: 'dateModified JSON-LD' });
        } else if (lowerKey.includes('created') || lowerKey.includes('published')) {
          hints.push({ year: exactYear, confidence: 2, source: `${key} JSON-LD` });
        }
      }
    }

    collectJsonDateHints(nestedValue, hints);
  }
}

async function estimateWebsiteRedesignYear(websiteUrl: string) {
  try {
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'TraeAccessibilityMvp/0.1',
        accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return null;
    }

    const hints: Array<{ year: number; confidence: number; source: string }> = [];
    const headerYear = extractYearFromDate(response.headers.get('last-modified'));
    if (headerYear !== null) {
      hints.push({ year: headerYear, confidence: 3, source: 'en-tete Last-Modified' });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('html')) {
      if (hints.length === 0) {
        return null;
      }

      const bestHint = hints.sort(
        (left, right) => right.confidence - left.confidence || right.year - left.year,
      )[0];
      return bestHint;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const metaSelectors: Array<[selector: string, source: string, confidence: number]> = [
      ['meta[property="article:modified_time"]', 'meta article:modified_time', 4],
      ['meta[property="og:updated_time"]', 'meta og:updated_time', 4],
      ['meta[name="last-modified"]', 'meta last-modified', 4],
      ['meta[name="date.modified"]', 'meta date.modified', 4],
      ['meta[name="dc.date.modified"]', 'meta dc.date.modified', 4],
      ['meta[name="date"]', 'meta date', 2],
    ];

    for (const [selector, source, confidence] of metaSelectors) {
      const metaYear = extractYearFromDate($(selector).attr('content'));
      if (metaYear !== null) {
        hints.push({ year: metaYear, confidence, source });
      }
    }

    $('script[type="application/ld+json"]').each((_, element) => {
      const rawJson = $(element).contents().text().trim();
      if (!rawJson) {
        return;
      }

      try {
        collectJsonDateHints(JSON.parse(rawJson), hints);
      } catch {
        // Ignore invalid JSON-LD blocks.
      }
    });

    const footerText = $('footer').text().trim();
    const footerYear = footerText ? getBestYearFromText(footerText) : null;
    if (footerYear !== null) {
      hints.push({ year: footerYear, confidence: 1, source: 'footer du site' });
    }

    const bodyYear = getBestYearFromText($('body').text().slice(0, 6000));
    if (bodyYear !== null) {
      hints.push({ year: bodyYear, confidence: 1, source: 'contenu de la page' });
    }

    if (hints.length === 0) {
      return null;
    }

    return hints.sort(
      (left, right) => right.confidence - left.confidence || right.year - left.year,
    )[0];
  } catch {
    return null;
  }
}

async function attachWebsiteInsights(
  resolution: WebsiteResolution,
): Promise<WebsiteResolution> {
  if (!resolution.websiteUrl) {
    return resolution;
  }

  const redesignEstimate = await estimateWebsiteRedesignYear(resolution.websiteUrl);
  if (!redesignEstimate) {
    return {
      ...resolution,
      websiteRedesignYear: null,
      notes: [...resolution.notes, 'Annee de refonte estimee indisponible'],
    };
  }

  return {
    ...resolution,
    websiteRedesignYear: redesignEstimate.year,
    notes: [
      ...resolution.notes,
      `Annee de refonte estimee: ${redesignEstimate.year} (${redesignEstimate.source})`,
    ],
  };
}

export async function resolveWebsite(
  company: CompanySearchResult,
  manualWebsite?: string,
): Promise<WebsiteResolution> {
  if (manualWebsite?.trim()) {
    return attachWebsiteInsights({
      websiteUrl: normalizeWebsite(manualWebsite),
      source: 'manuel',
      confidence: 'haute',
      websiteRedesignYear: null,
      notes: ['URL fournie manuellement par l’utilisateur'],
    });
  }

  try {
    const googleWebsite = await resolveWithGooglePlaces(company);
    if (googleWebsite) {
      return attachWebsiteInsights({
        websiteUrl: normalizeWebsite(googleWebsite),
        source: 'google_places',
        confidence: 'moyenne',
        websiteRedesignYear: null,
        notes: ['Site resolu via Google Places API'],
      });
    }
  } catch {
    // Ignore Google Places failures and continue with web search fallback.
  }

  try {
    const guessedWebsite = await resolveWithGuessedDomains(company);
    if (guessedWebsite) {
      return attachWebsiteInsights({
        websiteUrl: guessedWebsite,
        source: 'recherche_web',
        confidence: 'moyenne',
        websiteRedesignYear: null,
        notes: ['Site resolu via domaine probable verifie automatiquement'],
      });
    }
  } catch {
    // Ignore guessed-domain failures and continue with web search fallback.
  }

  try {
    const webSearchWebsite = await resolveWithWebSearch(company);
    if (webSearchWebsite) {
      return attachWebsiteInsights({
        websiteUrl: webSearchWebsite,
        source: 'recherche_web',
        confidence: 'moyenne',
        websiteRedesignYear: null,
        notes: ['Site resolu via recherche web automatique'],
      });
    }
  } catch {
    return {
      websiteUrl: null,
      source: 'inconnue',
      confidence: 'faible',
      websiteRedesignYear: null,
      notes: ['La resolution automatique du site a echoue'],
    };
  }

  return {
    websiteUrl: null,
    source: 'inconnue',
    confidence: 'faible',
    websiteRedesignYear: null,
    notes: ['Aucun site officiel n’a ete trouve automatiquement'],
  };
}

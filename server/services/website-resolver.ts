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

const minimumRelevantYear = 2000;

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
  if (placePayload.status && placePayload.status !== 'OK') {
    return null;
  }

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
  if (detailsPayload.status && detailsPayload.status !== 'OK') {
    return null;
  }

  return detailsPayload.result?.website ? normalizeWebsite(detailsPayload.result.website) : null;
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
        confidence: 'haute',
        websiteRedesignYear: null,
        notes: ['Site resolu via Google Places API'],
      });
    }
  } catch {
    return {
      websiteUrl: null,
      source: 'inconnue',
      confidence: 'faible',
      websiteRedesignYear: null,
      notes: ['La resolution via Google Places a echoue sur cette tentative'],
    };
  }

  return {
    websiteUrl: null,
    source: 'inconnue',
    confidence: 'faible',
    websiteRedesignYear: null,
    notes: ['Aucun site officiel n’a ete trouve via Google Places'],
  };
}

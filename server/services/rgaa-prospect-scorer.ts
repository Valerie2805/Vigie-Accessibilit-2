import * as cheerio from 'cheerio';
import type { RgaaProspectLevel, RgaaProspectScore } from '../types.js';

const RGAA_SIGNAL_RULES = [
  { keyword: 'rgaa', weight: 5, label: 'RGAA' },
  { keyword: 'audit rgaa', weight: 6, label: 'Audit RGAA' },
  { keyword: 'mise en conformite rgaa', weight: 6, label: 'Mise en conformite RGAA' },
  { keyword: 'accessibilite numerique', weight: 4, label: 'Accessibilite numerique' },
  { keyword: 'accessibilite web', weight: 3, label: 'Accessibilite web' },
  { keyword: 'wcag', weight: 4, label: 'WCAG' },
  { keyword: 'formation rgaa', weight: 5, label: 'Formation RGAA' },
  { keyword: 'formation accessibilite', weight: 4, label: 'Formation accessibilite' },
  { keyword: 'audit accessibilite', weight: 5, label: 'Audit accessibilite' },
  { keyword: 'diagnostic accessibilite', weight: 4, label: 'Diagnostic accessibilite' },
  { keyword: 'design inclusif', weight: 4, label: 'Design inclusif' },
  { keyword: 'conception inclusive', weight: 3, label: 'Conception inclusive' },
  { keyword: 'referent accessibilite', weight: 3, label: 'Referent accessibilite' },
  { keyword: 'schema pluriannuel', weight: 2, label: 'Schema pluriannuel' },
  { keyword: "declaration d'accessibilite", weight: 2, label: "Declaration d'accessibilite" },
  { keyword: 'declaration accessibilite', weight: 2, label: "Declaration d'accessibilite" },
  { keyword: 'remediation accessibilite', weight: 4, label: 'Remediation accessibilite' },
  { keyword: 'european accessibility act', weight: 3, label: 'European Accessibility Act' },
  { keyword: 'conformite eaa', weight: 3, label: 'Conformite EAA' },
];

const PROBABLE_PATHS = [
  '',
  '/accessibilite',
  '/accessibilite-numerique',
  '/audit',
  '/audit-accessibilite',
  '/rgaa',
  '/services',
  '/expertises',
  '/formation',
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function makeAbsoluteUrl(baseUrl: string, path: string) {
  const parsed = new URL(baseUrl);
  if (!path) {
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  }

  return new URL(path, parsed.toString()).toString();
}

function extractPageText(html: string) {
  const $ = cheerio.load(html);
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const title = $('title').text().trim();
  const h1 = $('h1').first().text().trim();

  return [title, h1, bodyText].filter(Boolean).join(' ');
}

function computeLevel(score: number, signalCount: number): RgaaProspectLevel {
  if (score >= 10 || signalCount >= 3) {
    return 'fort_probable';
  }

  if (score >= 6 || signalCount >= 2) {
    return 'probable';
  }

  if (score >= 2 || signalCount >= 1) {
    return 'faible';
  }

  return 'a_verifier';
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TraeAccessibilityMvp/0.1',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status})`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('html')) {
    throw new Error('Non HTML content');
  }

  return response.text();
}

export async function scoreRgaaProspect(websiteUrl: string | null): Promise<RgaaProspectScore> {
  if (!websiteUrl) {
    return {
      level: 'a_verifier',
      score: 0,
      signals: [],
      scannedUrl: null,
    };
  }

  const foundSignals = new Map<string, number>();
  let scannedUrl: string | null = null;

  for (const path of PROBABLE_PATHS) {
    const targetUrl = makeAbsoluteUrl(websiteUrl, path);

    try {
      const html = await fetchHtml(targetUrl);
      const pageText = normalizeText(extractPageText(html));
      scannedUrl = scannedUrl ?? targetUrl;

      for (const rule of RGAA_SIGNAL_RULES) {
        if (pageText.includes(normalizeText(rule.keyword))) {
          const currentWeight = foundSignals.get(rule.label) ?? 0;
          if (rule.weight > currentWeight) {
            foundSignals.set(rule.label, rule.weight);
          }
        }
      }
    } catch {
      continue;
    }
  }

  const signals = Array.from(foundSignals.keys());
  const score = Array.from(foundSignals.values()).reduce(
    (total, weight) => total + weight,
    0,
  );

  return {
    level: computeLevel(score, signals.length),
    score,
    signals,
    scannedUrl,
  };
}
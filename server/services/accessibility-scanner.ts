import * as cheerio from 'cheerio';
import type { ScanEvidence } from '../types.js';

const candidatePaths = [
  '',
  '/accessibilite',
  '/accessibility',
  '/mentions-legales',
  '/plan-du-site',
  '/sitemap.xml',
];

const keywordPatterns = [
  {
    kind: 'declaration' as const,
    label: "Declaration d'accessibilite detectee",
    pattern: /declaration d['’]accessibilite/i,
  },
  {
    kind: 'mention_accueil' as const,
    label: "Mention d'etat de conformite detectee",
    pattern: /accessibilite\s*:\s*(non conforme|partiellement conforme|totalement conforme)/i,
  },
  {
    kind: 'contact_accessibilite' as const,
    label: 'Mecanisme de contact accessibilite detecte',
    pattern: /(signaler un defaut d['’]accessibilite|contact accessibilite|besoin d['’]une alternative accessible)/i,
  },
  {
    kind: 'mot_cle' as const,
    label: 'Reference au Defenseur des droits detectee',
    pattern: /defenseur des droits/i,
  },
];

function createEvidence(
  kind: ScanEvidence['kind'],
  label: string,
  sourceUrl: string,
  excerpt?: string,
): ScanEvidence {
  return {
    id: crypto.randomUUID(),
    kind,
    label,
    sourceUrl,
    excerpt,
  };
}

export function extractAccessibilitySignals(html: string, sourceUrl: string) {
  const $ = cheerio.load(html);
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const evidences: ScanEvidence[] = [];

  const pageAccessibilityLinks = $('a')
    .map((_, element) => ({
      href: $(element).attr('href'),
      label: $(element).text().trim(),
    }))
    .get()
    .filter((link) => /accessibilite|accessibility/i.test(`${link.label} ${link.href ?? ''}`));

  if (pageAccessibilityLinks.length > 0) {
    evidences.push(
      createEvidence(
        'page_accessibilite',
        'Lien vers une page accessibilite detecte',
        sourceUrl,
        pageAccessibilityLinks[0]?.label || pageAccessibilityLinks[0]?.href,
      ),
    );
  }

  for (const keyword of keywordPatterns) {
    const match = text.match(keyword.pattern);
    if (match) {
      evidences.push(createEvidence(keyword.kind, keyword.label, sourceUrl, match[0]));
    }
  }

  return evidences;
}

export async function scanWebsite(websiteUrl: string) {
  const normalizedBase = websiteUrl.replace(/\/$/, '');
  const evidences: ScanEvidence[] = [];
  const notes: string[] = [];

  for (const path of candidatePaths) {
    const url = path ? `${normalizedBase}${path}` : normalizedBase;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TraeAccessibilityMvp/0.1',
        },
      });

      if (!response.ok) {
        notes.push(`Page ignoree (${response.status}) : ${url}`);
        continue;
      }

      const html = await response.text();
      const pageEvidences = extractAccessibilitySignals(html, url);
      evidences.push(...pageEvidences);
    } catch {
      notes.push(`Impossible de charger : ${url}`);
    }
  }

  const uniqueEvidences = Array.from(
    new Map(evidences.map((evidence) => [`${evidence.kind}-${evidence.sourceUrl}-${evidence.excerpt}`, evidence])).values(),
  );

  return {
    evidences: uniqueEvidences,
    notes,
  };
}

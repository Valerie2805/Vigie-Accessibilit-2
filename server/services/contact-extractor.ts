import * as cheerio from 'cheerio';

export type ContactExtraction = {
  email: string | null;
  emails: string[];
  notes: string[];
};

const candidatePaths = [
  '',
  '/contact',
  '/contact/',
  '/contactez-nous',
  '/contactez-nous/',
  '/nous-contacter',
  '/nous-contacter/',
  '/nous-joindre',
  '/nous-joindre/',
  '/contacts',
  '/contact-us',
  '/contact-us/',
  '/service-client',
  '/service-client/',
  '/mentions-legales',
  '/mentions-legales/',
  '/mentions-legales.html',
  '/mentions-legales.htm',
  '/mentions-legales.php',
  '/mentions',
  '/mentions/',
  '/politique-de-confidentialite',
  '/politique-de-confidentialite/',
  '/politique-confidentialite',
  '/politique-confidentialite/',
  '/confidentialite',
  '/confidentialite/',
  '/privacy-policy',
  '/privacy-policy/',
  '/politique-de-vie-privee',
  '/politique-de-vie-privee/',
  '/cgv',
  '/cgv/',
  '/cgu',
  '/cgu/',
  '/legal',
  '/legal/',
  '/a-propos',
  '/a-propos/',
  '/about',
  '/about/',
  '/footer/contact',
  '/support',
  '/support/',
  '/sav',
  '/sav/',
];

const priorityPathPattern =
  /(contact|mentions|legal|confidentialite|privacy|vie-privee|cgv|cgu)/i;

const contactLinkPattern =
  /(contact|contactez|nous-contacter|nous-joindre|mentions-legales|mentions|politique-de-confidentialite|politique-confidentialite|confidentialite|privacy-policy|vie-privee|cgv|cgu|support|sav|service-client|service client|about|a-propos|legal)/i;

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const looseObfuscatedEmailPattern =
  /([A-Z0-9._%+-]+)\s*(?:@|\(at\)|\[at\]|\bat\b|\barobase\b)\s*([A-Z0-9.-]+)\s*(?:\.|\(dot\)|\[dot\]|\bdot\b|\bpoint\b)\s*([A-Z]{2,})/gi;

const ignoredEmails = new Set([
  'example@example.com',
  'contact@example.com',
  'support@example.com',
  'admin@example.com',
  'hello@example.com',
  'test@test.com',
  'test@example.com',
]);

function normalizeEmail(raw: string) {
  const cleaned = raw.trim().replace(/[)\].,;:!?]+$/g, '');
  return cleaned.toLowerCase();
}

function uniq(items: string[]) {
  return Array.from(new Set(items));
}

function decodeObfuscatedEmail(raw: string) {
  return raw
    .trim()
    .replace(/\s*(?:\(|\[)?at(?:\)|\])?\s*/gi, '@')
    .replace(/\s+arobase\s+/gi, '@')
    .replace(/\s*(?:\(|\[)?dot(?:\)|\])?\s*/gi, '.')
    .replace(/\s+point\s+/gi, '.')
    .replace(/\s+/g, '');
}

function normalizeObfuscatedText(raw: string) {
  return raw
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\s*(?:\(|\[)\s*at\s*(?:\)|\])\s*/gi, '@')
    .replace(/\s+arobase\s+/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s*(?:\(|\[)\s*dot\s*(?:\)|\])\s*/gi, '.')
    .replace(/\s+point\s+/gi, '.')
    .replace(/\s+dot\s+/gi, '.')
    .replace(/\s*@\s*/g, '@')
    .replace(/\s*\.\s*/g, '.');
}

function extractLooselyObfuscatedEmails(raw: string) {
  return Array.from(raw.matchAll(looseObfuscatedEmailPattern)).map((match) =>
    normalizeEmail(`${match[1]}@${match[2]}.${match[3]}`),
  );
}

function extractEmailsFromRaw(raw: string) {
  const directMatches = (raw.match(emailPattern) ?? []).map(normalizeEmail);
  const obfuscatedMatches = (normalizeObfuscatedText(raw).match(emailPattern) ?? [])
    .map(decodeObfuscatedEmail)
    .map(normalizeEmail);
  const looseMatches = extractLooselyObfuscatedEmails(raw);

  return uniq([...directMatches, ...obfuscatedMatches, ...looseMatches]).filter(
    isProbablyValidEmail,
  );
}

function decodeCloudflareEmail(encoded: string) {
  const normalized = encoded.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(normalized) || normalized.length < 4 || normalized.length % 2 !== 0) {
    return null;
  }

  try {
    const key = Number.parseInt(normalized.slice(0, 2), 16);
    let decoded = '';

    for (let index = 2; index < normalized.length; index += 2) {
      const value = Number.parseInt(normalized.slice(index, index + 2), 16) ^ key;
      decoded += String.fromCharCode(value);
    }

    return normalizeEmail(decoded);
  } catch {
    return null;
  }
}

function isProbablyValidEmail(email: string) {
  if (email.length > 254) return false;
  if (ignoredEmails.has(email)) return false;
  if (!email.includes('@')) return false;
  const [local, domain] = email.split('@');
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (!domain.includes('.')) return false;
  return true;
}

function extractEmailsFromHtml(html: string) {
  const $ = cheerio.load(html);
  const mailtos = $('a[href^="mailto:"]')
    .map((_, element) => $(element).attr('href') ?? '')
    .get()
    .map((href) => href.replace(/^mailto:/i, '').split('?')[0] ?? '')
    .map(normalizeEmail)
    .filter(Boolean)
    .filter(isProbablyValidEmail);
  const cloudflareEmails = uniq([
    ...$('[data-cfemail]')
      .map((_, element) => decodeCloudflareEmail($(element).attr('data-cfemail') ?? ''))
      .get()
      .filter((value): value is string => Boolean(value)),
    ...$('a[href*="/cdn-cgi/l/email-protection#"]')
      .map((_, element) => {
        const href = $(element).attr('href') ?? '';
        const encoded = href.split('#')[1] ?? '';
        return decodeCloudflareEmail(encoded);
      })
      .get()
      .filter((value): value is string => Boolean(value)),
  ]).filter(isProbablyValidEmail);

  const text = $('body').text();
  const htmlMatches = (html.match(emailPattern) ?? []).map(normalizeEmail);
  const textMatches = (text.match(emailPattern) ?? []).map(normalizeEmail);
  const obfuscatedHtmlMatches = (normalizeObfuscatedText(html).match(emailPattern) ?? [])
    .map(decodeObfuscatedEmail)
    .map(normalizeEmail);
  const obfuscatedTextMatches = (normalizeObfuscatedText(text).match(emailPattern) ?? [])
    .map(decodeObfuscatedEmail)
    .map(normalizeEmail);
  const looseHtmlMatches = extractLooselyObfuscatedEmails(html);
  const looseTextMatches = extractLooselyObfuscatedEmails(text);

  const combined = uniq([
    ...mailtos,
    ...cloudflareEmails,
    ...htmlMatches,
    ...textMatches,
    ...obfuscatedHtmlMatches,
    ...obfuscatedTextMatches,
    ...looseHtmlMatches,
    ...looseTextMatches,
  ]).filter(isProbablyValidEmail);
  return {
    emails: combined,
    primaryEmail: combined[0] ?? null,
  };
}

async function fetchHtml(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TraeAccessibilityMvp/0.1',
      },
      signal: AbortSignal.timeout(6500),
    });

    if (!response.ok) {
      return {
        url,
        html: null as string | null,
        status: response.status,
      };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return {
        url,
        html: null as string | null,
        status: response.status,
      };
    }

    return {
      url,
      html: await response.text(),
      status: response.status,
    };
  } catch {
    return {
      url,
      html: null as string | null,
      status: null as number | null,
    };
  }
}

function resolveUrl(baseUrl: string, href: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractContactLinks(baseUrl: string, html: string) {
  const $ = cheerio.load(html);
  const links = $('a')
    .map((_, element) => ({
      href: $(element).attr('href'),
      label: $(element).text().trim(),
    }))
    .get()
    .map((link) => ({
      href: link.href?.trim() ?? '',
      label: link.label,
    }))
    .filter((link) => link.href.length > 0)
    .filter((link) => contactLinkPattern.test(`${link.label} ${link.href}`))
    .map((link) => resolveUrl(baseUrl, link.href))
    .filter((value): value is string => Boolean(value));

  return uniq(links);
}

function parseSearchResultUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl, 'https://duckduckgo.com');
    const redirected = parsed.searchParams.get('uddg');
    return redirected ? decodeURIComponent(redirected) : parsed.toString();
  } catch {
    return rawUrl;
  }
}

function extractSearchCandidates(html: string) {
  const $ = cheerio.load(html);
  return $('a.result__a, a[data-testid="result-title-a"], .result a[href], .links_main a[href]')
    .slice(0, 8)
    .map((_, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();
      const snippet =
        $(element)
          .closest('.result, .web-result')
          .find('.result__snippet, .result__extras')
          .text()
          .trim() ?? '';

      if (!href || !title) {
        return null;
      }

      return {
        url: parseSearchResultUrl(href),
        title,
        snippet,
      };
    })
    .get()
    .filter(
      (candidate): candidate is { url: string; title: string; snippet: string } =>
        Boolean(candidate),
    );
}

async function searchEmailsOnWeb(websiteUrl: string) {
  const notes: string[] = [];
  const foundEmails = new Set<string>();

  let host = '';
  let canonicalHost = '';
  try {
    host = new URL(websiteUrl).host;
    canonicalHost = host.replace(/^www\./i, '');
  } catch {
    return { emails: [], notes };
  }

  const queries = [
    `site:${host} ${canonicalHost}`,
    `site:${host} contact@${canonicalHost}`,
    `site:${host} email`,
  ];

  const fetchedPages = new Set<string>();

  for (const query of queries) {
    const searchUrl = new URL('https://html.duckduckgo.com/html/');
    searchUrl.searchParams.set('q', query);

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'TraeAccessibilityMvp/0.1',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        notes.push(`Recherche web ignoree (${response.status}) : ${query}`);
        continue;
      }

      const html = await response.text();
      const candidates = extractSearchCandidates(html);

      for (const candidate of candidates) {
        for (const email of extractEmailsFromRaw(
          `${candidate.title} ${candidate.snippet} ${candidate.url}`,
        )) {
          foundEmails.add(email);
        }

        if (fetchedPages.size >= 3) {
          continue;
        }

        try {
          const candidateUrl = new URL(candidate.url);
          const candidateHost = candidateUrl.host.replace(/^www\./i, '');
          if (candidateHost !== canonicalHost) {
            continue;
          }
        } catch {
          continue;
        }

        if (fetchedPages.has(candidate.url)) {
          continue;
        }

        fetchedPages.add(candidate.url);
        const pageResult = await fetchHtml(candidate.url);
        if (!pageResult.html) {
          continue;
        }

        for (const email of extractEmailsFromHtml(pageResult.html).emails) {
          foundEmails.add(email);
        }
      }
    } catch {
      notes.push(`Recherche web impossible : ${query}`);
    }

    if (foundEmails.size > 0) {
      break;
    }
  }

  return {
    emails: Array.from(foundEmails),
    notes,
  };
}

export async function extractContacts(websiteUrl: string): Promise<ContactExtraction> {
  const base = websiteUrl.replace(/\/$/, '');
  const baseHost = (() => {
    try {
      return new URL(base).host;
    } catch {
      return null;
    }
  })();
  const notes: string[] = [];
  const visited = new Set<string>();
  const queued = new Set<string>();
  const toVisit: string[] = [];
  const MAX_VISITED_PAGES = 20;

  // Prioritize contact pages discovered from the homepage before exhausting fallback paths.
  function enqueue(url: string | null | undefined, priority = false) {
    if (!url || visited.has(url)) {
      return;
    }

    if (queued.has(url)) {
      if (priority) {
        const existingIndex = toVisit.indexOf(url);
        if (existingIndex >= 0) {
          toVisit.splice(existingIndex, 1);
          toVisit.unshift(url);
        }
      }
      return;
    }

    if (priority) {
      toVisit.unshift(url);
    } else {
      toVisit.push(url);
    }
    queued.add(url);
  }

  enqueue(base);
  const prioritizedPaths = candidatePaths.filter((path) => path && priorityPathPattern.test(path));
  const secondaryPaths = candidatePaths.filter(
    (path) => path && !priorityPathPattern.test(path),
  );

  for (const path of [...prioritizedPaths, ...secondaryPaths]) {
    enqueue(resolveUrl(base, path));
  }

  let emails: string[] = [];

  while (toVisit.length > 0) {
    if (visited.size >= MAX_VISITED_PAGES) {
      notes.push(`Limite d'exploration atteinte (${MAX_VISITED_PAGES} pages)`);
      break;
    }

    const url = toVisit.shift();
    if (!url || visited.has(url)) {
      continue;
    }

    queued.delete(url);
    visited.add(url);
    const result = await fetchHtml(url);
    if (!result.html) {
      notes.push(
        result.status ? `Page ignoree (${result.status}) : ${url}` : `Impossible de charger : ${url}`,
      );
      continue;
    }

    const extraction = extractEmailsFromHtml(result.html);
    if (extraction.emails.length > 0) {
      emails = uniq([...emails, ...extraction.emails]);
    }

    if (visited.size <= 4) {
      const discoveredLinks = extractContactLinks(url, result.html).filter((link) => {
        if (!baseHost) return false;
        try {
          return new URL(link).host === baseHost;
        } catch {
          return false;
        }
      });
      for (const link of discoveredLinks.slice(0, 8)) {
        enqueue(link, true);
      }
    }

    if (emails.length > 0 && visited.size >= 5) {
      break;
    }
  }

  if (emails.length === 0) {
    const webFallback = await searchEmailsOnWeb(base);
    if (webFallback.emails.length > 0) {
      emails = uniq([...emails, ...webFallback.emails]);
      notes.push('Email trouve via recherche web publique');
    }
    notes.push(...webFallback.notes);
  }

  return {
    email: emails[0] ?? null,
    emails,
    notes,
  };
}

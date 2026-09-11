import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveWebsite } from './website-resolver.js';

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}

describe('resolveWebsite', () => {
  afterEach(() => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('utilise la recherche web si Google Places est indisponible', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.startsWith('https://html.duckduckgo.com/html/')) {
          return htmlResponse(`
            <div class="result">
              <a class="result__a" href="https://www.societe.com/societe/ramery-travaux-publics-617120118.html">
                RAMERY TRAVAUX PUBLICS
              </a>
              <div class="result__snippet">Annuaire legal</div>
            </div>
            <div class="result">
              <a class="result__a" href="https://www.ramery.fr/metiers/travaux-publics/">
                Travaux publics - Ramery
              </a>
              <div class="result__snippet">Site officiel du groupe Ramery</div>
            </div>
          `);
        }

        throw new Error(`Unexpected URL: ${url}`);
      }),
    );

    const result = await resolveWebsite({
      siren: '617120118',
      nom: 'RAMERY TRAVAUX PUBLICS',
      ville: 'ERQUINGHEM-LYS',
      codePostal: '59193',
      activite: '42.11Z',
      categorieEntreprise: 'ETI',
      trancheEffectif: '41',
      adresse: '740 RUE DU BAC 59193 ERQUINGHEM-LYS',
      chiffreAffaires: 149224280,
      source: 'demo',
    });

    expect(result.websiteUrl).toBe('https://www.ramery.fr');
    expect(result.source).toBe('recherche_web');
  });

  it('garde la saisie manuelle prioritaire', async () => {
    const result = await resolveWebsite(
      {
        siren: '617120118',
        nom: 'RAMERY TRAVAUX PUBLICS',
        ville: 'ERQUINGHEM-LYS',
        codePostal: '59193',
        activite: '42.11Z',
        categorieEntreprise: 'ETI',
        trancheEffectif: '41',
        adresse: '740 RUE DU BAC 59193 ERQUINGHEM-LYS',
        chiffreAffaires: 149224280,
        source: 'demo',
      },
      'https://www.ramery.fr/contact',
    );

    expect(result.websiteUrl).toBe('https://www.ramery.fr/contact');
    expect(result.source).toBe('manuel');
  });
});


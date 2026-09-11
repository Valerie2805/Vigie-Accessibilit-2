import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractContacts } from './contact-extractor.js';

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
    },
  });
}

describe('extractContacts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('extrait un email via mailto', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://exemple.fr') {
          return htmlResponse('<a href="mailto:contact@exemple.fr">Contact</a>');
        }
        return htmlResponse('', 404);
      }),
    );

    const result = await extractContacts('https://exemple.fr');
    expect(result.email).toBe('contact@exemple.fr');
  });

  it('prefere un email reel et ignore les placeholders', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://entreprise.fr') {
          return htmlResponse(
            '<a href="/contact">Contact</a><p>contact@example.com</p><p>bonjour@entreprise.fr</p>',
          );
        }
        if (url === 'https://entreprise.fr/contact') {
          return htmlResponse('<p>Email: support@entreprise.fr</p>');
        }
        return htmlResponse('', 404);
      }),
    );

    const result = await extractContacts('https://entreprise.fr');
    expect(result.emails).toContain('bonjour@entreprise.fr');
    expect(result.emails).toContain('support@entreprise.fr');
    expect(result.emails).not.toContain('contact@example.com');
    expect(result.email).toBe('bonjour@entreprise.fr');
  });

  it('decode un email masque dans le texte', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://assureur.fr') {
          return htmlResponse('<p>Contact : relation-client [at] assureur [dot] fr</p>');
        }
        return htmlResponse('', 404);
      }),
    );

    const result = await extractContacts('https://assureur.fr');
    expect(result.email).toBe('relation-client@assureur.fr');
  });

  it('explore plusieurs liens de contact trouves sur le site', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === 'https://mutuelle.fr') {
          return htmlResponse(
            '<a href="/agences">Agences</a><a href="/nous-joindre">Nous joindre</a>',
          );
        }
        if (url === 'https://mutuelle.fr/nous-joindre') {
          return htmlResponse('<p>serviceclient@mutuelle.fr</p>');
        }
        return htmlResponse('', 404);
      }),
    );

    const result = await extractContacts('https://mutuelle.fr');
    expect(result.email).toBe('serviceclient@mutuelle.fr');
  });
});

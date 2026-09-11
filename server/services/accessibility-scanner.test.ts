import { describe, expect, it } from 'vitest';
import { extractAccessibilitySignals } from './accessibility-scanner.js';

describe('extractAccessibilitySignals', () => {
  it('detecte une page accessibilite et une declaration', () => {
    const html = `
      <html>
        <body>
          <footer>
            <a href="/accessibilite">Accessibilite</a>
          </footer>
          <main>
            <p>Declaration d'accessibilite</p>
            <p>Accessibilite : partiellement conforme</p>
            <p>Signaler un defaut d'accessibilite</p>
          </main>
        </body>
      </html>
    `;

    const result = extractAccessibilitySignals(html, 'https://exemple.fr');

    expect(result.some((evidence) => evidence.kind === 'page_accessibilite')).toBe(true);
    expect(result.some((evidence) => evidence.kind === 'declaration')).toBe(true);
    expect(result.some((evidence) => evidence.kind === 'mention_accueil')).toBe(true);
    expect(result.some((evidence) => evidence.kind === 'contact_accessibilite')).toBe(true);
  });
});

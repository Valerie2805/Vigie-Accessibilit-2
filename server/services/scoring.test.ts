import { describe, expect, it } from 'vitest';
import { computeScore, estimateEligibility } from './scoring.js';

describe('estimateEligibility', () => {
  it('classe une grande entreprise comme soumise probable', () => {
    expect(
      estimateEligibility({
        siren: '356000000',
        nom: 'LA POSTE',
        ville: 'PARIS',
        codePostal: '75015',
        activite: '53.10Z',
        categorieEntreprise: 'GE',
        trancheEffectif: '53',
        adresse: '9 RUE DU COLONEL PIERRE AVIA 75015 PARIS',
        chiffreAffaires: 34_569_000_000,
        source: 'demo',
      }),
    ).toBe('soumis_probable');
  });

  it('classe une activite e-commerce dans la zone incertaine si le CA manque', () => {
    expect(
      estimateEligibility({
        siren: '123456789',
        nom: 'BOUTIQUE TEST',
        ville: 'NANTES',
        codePostal: '44000',
        activite: '47.91B',
        categorieEntreprise: null,
        trancheEffectif: null,
        adresse: '1 RUE DU TEST 44000 NANTES',
        chiffreAffaires: null,
        source: 'demo',
      }),
    ).toBe('incertain');
  });
});

describe('computeScore', () => {
  it('retourne un score fort avec declaration et page accessibilite', () => {
    const result = computeScore(
      'soumis_probable',
      [
        {
          id: '1',
          kind: 'page_accessibilite',
          label: 'Page accessibilite',
          sourceUrl: 'https://exemple.fr/accessibilite',
        },
        {
          id: '2',
          kind: 'declaration',
          label: 'Declaration',
          sourceUrl: 'https://exemple.fr/accessibilite',
        },
      ],
      true,
    );

    expect(result.score).toBe(65);
    expect(result.status).toBe('elements_detectes');
  });

  it('abaisse le score quand une entreprise soumise probable ne fournit aucun signal', () => {
    const result = computeScore('soumis_probable', [], true);
    expect(result.score).toBe(-30);
    expect(result.status).toBe('conformite_non_demontree');
  });
});

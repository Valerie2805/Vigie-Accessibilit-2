import type { CompanySearchResult } from '../types.js';

const SEARCH_API_URL = 'https://recherche-entreprises.api.gouv.fr/search';
const SEARCH_RESULTS_PER_PAGE = 20;
const SEARCH_MAX_PAGES = 10;
type CompanySizeFilter = 'tous' | 'pme' | 'ge';

const activityNafCodeMap: Record<string, string[]> = {
  banque: ['64.19Z', '64.92Z'],
  assurance: ['65.11Z', '65.12Z', '65.20Z', '65.30Z'],
  mutuelle: ['65.12Z', '65.20Z'],
  'e-commerce': ['47.91A', '47.91B'],
  transport: ['49.10Z', '49.31Z', '49.39A', '49.39B', '49.39C', '50.10Z', '50.30Z'],
  telecommunications: ['61.10Z', '61.20Z', '61.30Z', '61.90Z'],
  'service public': ['84.11Z', '84.12Z', '84.13Z', '84.30A', '84.30B'],
  'mission de service public': ['84.11Z', '84.12Z', '84.13Z', '84.30A', '84.30B'],
  'sante privee': ['86.10Z', '86.21Z', '86.22A', '86.22B', '86.22C', '86.23Z', '86.90A', '86.90B', '86.90D', '86.90E', '86.90F'],
  energie: ['35.11Z', '35.12Z', '35.13Z', '35.14Z', '35.21Z', '35.22Z', '35.23Z', '35.30Z'],
  'eau services essentiels': ['36.00Z', '37.00Z', '38.11Z', '38.21Z', '39.00Z'],
  'grande distribution': ['47.11A', '47.11B', '47.11C', '47.11D', '47.11F', '47.19A'],
  'tourisme hotellerie': ['55.10Z', '55.20Z', '55.30Z', '55.90Z', '79.11Z', '79.12Z', '79.90Z'],
  immobilier: ['68.10Z', '68.20A', '68.20B', '68.31Z', '68.32A', '68.32B'],
  'travaux publics': ['41.20A', '41.20B', '42.11Z', '42.12Z', '42.13A', '42.13B', '42.21Z', '42.22Z', '42.91Z', '42.99Z', '43.11Z', '43.12A', '43.12B'],
  'education formation': ['85.10Z', '85.20Z', '85.31Z', '85.32Z', '85.41Z', '85.42Z', '85.51Z', '85.52Z', '85.53Z', '85.59A', '85.59B', '85.60Z'],
  'medias audiovisuel': ['58.13Z', '58.14Z', '59.11A', '59.11B', '59.11C', '59.12Z', '59.13A', '59.13B', '59.14Z', '60.10Z', '60.20A', '60.20B', '63.91Z'],
  'livres numeriques': ['58.11Z', '58.19Z'],
};
const employeeRangeByTranche: Record<string, { min: number; max: number | null }> = {
  '00': { min: 0, max: 0 },
  '01': { min: 1, max: 2 },
  '02': { min: 3, max: 5 },
  '03': { min: 6, max: 9 },
  '11': { min: 10, max: 19 },
  '12': { min: 20, max: 49 },
  '21': { min: 50, max: 99 },
  '22': { min: 100, max: 199 },
  '31': { min: 200, max: 249 },
  '32': { min: 250, max: 499 },
  '41': { min: 500, max: 999 },
  '42': { min: 1000, max: 1999 },
  '51': { min: 2000, max: 4999 },
  '52': { min: 5000, max: 9999 },
  '53': { min: 10000, max: null },
};

const demoCompanies: CompanySearchResult[] = [
  {
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
  },
  {
    siren: '542051180',
    nom: 'LVMH MOET HENNESSY LOUIS VUITTON',
    ville: 'PARIS',
    codePostal: '75008',
    activite: '70.10Z',
    categorieEntreprise: 'GE',
    trancheEffectif: '32',
    adresse: '22 AVENUE MONTAIGNE 75008 PARIS',
    chiffreAffaires: 86_153_000_000,
    source: 'demo',
  },
];

type SearchApiResponse = {
  results?: Array<{
    siren?: string;
    nom_complet?: string;
    nom_raison_sociale?: string;
    activite_principale?: string;
    categorie_entreprise?: string;
    tranche_effectif_salarie?: string;
    siege?: {
      adresse?: string;
      code_postal?: string;
      libelle_commune?: string;
    };
    finances?: Record<string, { ca?: number | null }>;
  }>;
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function getActivityNafCodes(metier?: string) {
  if (!metier?.trim()) {
    return [];
  }

  return activityNafCodeMap[normalizeText(metier)] ?? [];
}

function matchesCity(company: CompanySearchResult, city?: string) {
  if (!city?.trim()) {
    return true;
  }

  const normalizedCity = normalizeText(city);
  const candidateValues = [company.ville, company.adresse].filter(Boolean) as string[];

  return candidateValues.some((value) => normalizeText(value).includes(normalizedCity));
}

function normalizeNafCode(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

function splitMultiValue(value?: string) {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(/[;,/]|(?:\bou\b)|(?:\bor\b)/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNafCodes(value?: string) {
  if (!value?.trim()) {
    return [];
  }

  const matchedCodes = value.match(/\b\d{2}\.\d{2}[A-Z]\b/gi);
  if (matchedCodes && matchedCodes.length > 0) {
    return matchedCodes.map((item) => normalizeNafCode(item));
  }

  return splitMultiValue(value).map((item) => normalizeNafCode(item));
}

function parseDepartments(value?: string) {
  return splitMultiValue(value).map((item) => normalizeText(item));
}

function matchesNafCode(company: CompanySearchResult, nafCode?: string) {
  const expectedCodes = parseNafCodes(nafCode);
  if (expectedCodes.length === 0) {
    return true;
  }

  const companyNafCode = company.activite ? normalizeNafCode(company.activite) : null;
  if (!companyNafCode) {
    return false;
  }

  return expectedCodes.includes(companyNafCode);
}

function inferDepartmentFromPostalCode(codePostal?: string | null) {
  if (!codePostal) {
    return null;
  }

  const trimmedPostalCode = codePostal.trim();
  if (trimmedPostalCode.length < 2) {
    return null;
  }

  if (trimmedPostalCode.startsWith('97') || trimmedPostalCode.startsWith('98')) {
    return trimmedPostalCode.slice(0, 3);
  }

  return trimmedPostalCode.slice(0, 2);
}

function matchesDepartment(company: CompanySearchResult, department?: string) {
  const expectedDepartments = parseDepartments(department);
  if (expectedDepartments.length === 0) {
    return true;
  }

  const inferredDepartment = inferDepartmentFromPostalCode(company.codePostal);
  if (!inferredDepartment) {
    return false;
  }

  return expectedDepartments.includes(normalizeText(inferredDepartment));
}

function matchesMetier(company: CompanySearchResult, metier?: string) {
  if (!metier?.trim()) {
    return true;
  }

  const normalizedMetier = normalizeText(metier);
  const mappedActivityCodes = getActivityNafCodes(metier);
  const companyNafCode = company.activite ? normalizeNafCode(company.activite) : null;

  if (mappedActivityCodes.length > 0) {
    if (companyNafCode && mappedActivityCodes.includes(companyNafCode)) {
      return true;
    }
  }

  const candidateValues = [company.nom, company.adresse, company.activite].filter(Boolean) as string[];

  return candidateValues.some((value) => normalizeText(value).includes(normalizedMetier));
}

function matchesCompanySize(company: CompanySearchResult, companySize: CompanySizeFilter = 'tous') {
  if (companySize === 'tous') {
    return true;
  }

  const normalizedCategory = normalizeText(company.categorieEntreprise ?? '');
  const range =
    (company.trancheEffectif && employeeRangeByTranche[company.trancheEffectif]) || null;

  if (companySize === 'pme') {
    if (normalizedCategory === 'ge' || normalizedCategory === 'eti') {
      return false;
    }

    if (normalizedCategory === 'pme') {
      return true;
    }

    if (!range) {
      return false;
    }

    return range.max !== null && range.max <= 249;
  }

  if (normalizedCategory === 'ge') {
    return true;
  }

  if (!range) {
    return false;
  }

  return range.min >= 5000;
}

function matchesRevenue(
  company: CompanySearchResult,
  minRevenue?: number,
  maxRevenue?: number,
) {
  const revenue = company.chiffreAffaires;

  if (minRevenue === undefined && maxRevenue === undefined) {
    return true;
  }

  if (revenue === null) {
    return true;
  }

  if (minRevenue !== undefined && revenue < minRevenue) {
    return false;
  }

  if (maxRevenue !== undefined && revenue > maxRevenue) {
    return false;
  }

  return true;
}

function matchesEmployees(
  company: CompanySearchResult,
  minEmployees?: number,
  maxEmployees?: number,
) {
  if (minEmployees === undefined && maxEmployees === undefined) {
    return true;
  }

  const range =
    (company.trancheEffectif && employeeRangeByTranche[company.trancheEffectif]) || null;

  if (!range) {
    return true;
  }

  if (minEmployees !== undefined && range.max !== null && range.max < minEmployees) {
    return false;
  }

  if (maxEmployees !== undefined && range.min > maxEmployees) {
    return false;
  }

  return true;
}

function pickLatestRevenue(
  finances?: Record<string, { ca?: number | null }>,
): number | null {
  if (!finances) {
    return null;
  }

  const years = Object.keys(finances).sort().reverse();
  for (const year of years) {
    const revenue = finances[year]?.ca;
    if (typeof revenue === 'number') {
      return revenue;
    }
  }

  return null;
}

function mapCompany(item: SearchApiResponse['results'][number]): CompanySearchResult | null {
  if (!item?.siren) {
    return null;
  }

  return {
    siren: item.siren,
    nom: item.nom_raison_sociale ?? item.nom_complet ?? item.siren,
    ville: item.siege?.libelle_commune ?? null,
    codePostal: item.siege?.code_postal ?? null,
    activite: item.activite_principale ?? null,
    categorieEntreprise: item.categorie_entreprise ?? null,
    trancheEffectif: item.tranche_effectif_salarie ?? null,
    adresse: item.siege?.adresse ?? null,
    chiffreAffaires: pickLatestRevenue(item.finances),
    source: 'api_recherche_entreprises',
  };
}

async function fetchSearchPage(params: {
  query?: string;
  city?: string;
  department?: string;
  nafCode?: string;
  page: number;
}) {
  const url = new URL(SEARCH_API_URL);

  if (params.query?.trim()) {
    url.searchParams.set('q', params.query.trim());
  }

  url.searchParams.set('page', String(params.page));
  url.searchParams.set('per_page', String(SEARCH_RESULTS_PER_PAGE));

  if (params.city?.trim()) {
    url.searchParams.set('libelle_commune', params.city.trim());
  }

  if (params.department?.trim()) {
    url.searchParams.set('departement', params.department.trim());
  }

  if (params.nafCode?.trim()) {
    url.searchParams.set('activite_principale', normalizeNafCode(params.nafCode));
  }

  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'User-Agent': 'TraeAccessibilityMvp/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Search API responded with ${response.status}`);
  }

  return (await response.json()) as SearchApiResponse;
}

function buildSearchCombos(params: { department?: string; nafCode?: string }) {
  const departments = parseDepartments(params.department);
  const nafCodes = Array.from(new Set(parseNafCodes(params.nafCode)));

  const departmentValues = departments.length > 0 ? departments : [''];
  const nafValues = nafCodes.length > 0 ? nafCodes : [''];
  const combos: Array<{ department?: string; nafCode?: string }> = [];

  for (const department of departmentValues) {
    for (const nafCode of nafValues) {
      combos.push({
        department: department || undefined,
        nafCode: nafCode || undefined,
      });
    }
  }

  return combos;
}

export async function searchCompanies(
  query?: string,
  city?: string,
  department?: string,
  metier?: string,
  nafCode?: string,
  minRevenue?: number,
  maxRevenue?: number,
  minEmployees?: number,
  maxEmployees?: number,
  companySize: CompanySizeFilter = 'tous',
) {
  const cleanedQuery = query?.trim() ?? '';
  const cleanedMetier = metier?.trim() ?? '';
  const cleanedDepartment = department?.trim() ?? '';
  const cleanedNafCode = nafCode?.trim() ?? '';
  const mappedActivityCodes = getActivityNafCodes(cleanedMetier);
  const effectiveNafCode = cleanedNafCode || mappedActivityCodes.join(',');

  if (!cleanedQuery && !cleanedMetier && !cleanedDepartment && !cleanedNafCode && !city?.trim()) {
    return [];
  }

  const metierQueryTerm = mappedActivityCodes.length > 0 ? '' : cleanedMetier;
  const combinedQuery = [cleanedQuery, metierQueryTerm, city?.trim() ?? '']
    .filter(Boolean)
    .join(' ')
    .trim();

  const collectedResults: CompanySearchResult[] = [];
  const seenSirens = new Set<string>();
  const combos = buildSearchCombos({
    department: cleanedDepartment,
    nafCode: effectiveNafCode,
  });
  let hasSuccessfulRequest = false;

  for (const combo of combos) {
    for (let page = 1; page <= SEARCH_MAX_PAGES; page += 1) {
      let payload: SearchApiResponse;

      try {
        payload = await fetchSearchPage({
          query: combinedQuery || undefined,
          city: city?.trim() || undefined,
          department: combo.department,
          nafCode: combo.nafCode,
          page,
        });
        hasSuccessfulRequest = true;
      } catch {
        break;
      }

      const pageResults = (payload.results ?? [])
        .map(mapCompany)
        .filter(Boolean) as CompanySearchResult[];

      for (const company of pageResults) {
        if (!seenSirens.has(company.siren)) {
          seenSirens.add(company.siren);
          collectedResults.push(company);
        }
      }

      if (pageResults.length < SEARCH_RESULTS_PER_PAGE) {
        break;
      }
    }
  }

  if (hasSuccessfulRequest) {
    return collectedResults
      .filter((company) => matchesCity(company, city))
      .filter((company) => matchesDepartment(company, department))
      .filter((company) => matchesNafCode(company, effectiveNafCode))
      .filter((company) => matchesMetier(company, metier))
      .filter((company) => matchesRevenue(company, minRevenue, maxRevenue))
      .filter((company) => matchesEmployees(company, minEmployees, maxEmployees))
      .filter((company) => matchesCompanySize(company, companySize));
  }

  {
    return demoCompanies.filter((company) => {
      const haystack = `${company.nom} ${company.siren} ${company.ville ?? ''}`.toLowerCase();
      const matchesQuery =
        !cleanedQuery || haystack.includes(cleanedQuery.toLowerCase());

      return (
        matchesQuery &&
        matchesCity(company, city) &&
        matchesDepartment(company, department) &&
        matchesNafCode(company, effectiveNafCode) &&
        matchesMetier(company, metier) &&
        matchesRevenue(company, minRevenue, maxRevenue) &&
        matchesEmployees(company, minEmployees, maxEmployees) &&
        matchesCompanySize(company, companySize)
      );
    });
  }
}

export async function getCompanyBySiren(siren: string) {
  const results = await searchCompanies(siren);
  return results.find((company) => company.siren === siren) ?? null;
}

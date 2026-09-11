import { Router } from 'express';
import { z } from 'zod';
import { resolveCompanyEmail } from '../services/company-email-resolver.js';
import { getCompanyBySiren, searchCompanies } from '../services/company-search.js';
import { scoreRgaaProspect } from '../services/rgaa-prospect-scorer.js';
import { estimateEligibility } from '../services/scoring.js';
import {
  getCompanyFromStorage,
  listCompanies,
  listScans,
  setCompanyEmail,
  setCompanyWebsite,
  upsertCompaniesFromSearch,
} from '../services/storage.js';
import { resolveWebsite } from '../services/website-resolver.js';

const router = Router();
const WEBSITE_RESOLUTION_TIMEOUT_MS = 4500;
const EMAIL_RESOLUTION_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    }),
  ]);
}

async function getLatestScanIndex() {
  const bySiren = new Map<string, { status: string; scannedAt: string }>();

  for (const scan of await listScans()) {
    const existing = bySiren.get(scan.siren);
    if (!existing || existing.scannedAt < scan.scannedAt) {
      bySiren.set(scan.siren, {
        status: scan.status,
        scannedAt: scan.scannedAt,
      });
    }
  }

  return bySiren;
}

router.get('/search', async (req, res, next) => {
  const schema = z.object({
    q: z.string().optional().default(''),
    city: z.string().optional(),
    department: z.string().optional(),
    metier: z.string().optional(),
    nafCode: z.string().optional(),
    minRevenue: z.coerce.number().nonnegative().optional(),
    maxRevenue: z.coerce.number().nonnegative().optional(),
    minEmployees: z.coerce.number().int().nonnegative().optional(),
    maxEmployees: z.coerce.number().int().nonnegative().optional(),
  });

  try {
    const params = schema.parse(req.query);
    const hasEnoughCriteria =
      params.q.trim().length >= 2 ||
      (params.metier?.trim().length ?? 0) >= 2 ||
      (params.nafCode?.trim().length ?? 0) >= 4 ||
      (params.department?.trim().length ?? 0) >= 2 ||
      (params.city?.trim().length ?? 0) >= 2;

    if (!hasEnoughCriteria) {
      res.status(400).json({
        success: false,
        error:
          'Renseigne au moins un nom, un metier, un code NAF, une ville ou un departement',
      });
      return;
    }

    const results = await searchCompanies(
      params.q,
      params.city,
      params.department,
      params.metier,
      params.nafCode,
      params.minRevenue,
      params.maxRevenue,
      params.minEmployees,
      params.maxEmployees,
    );

    const storedCompanies = await upsertCompaniesFromSearch(results);
    const storedIndex = new Map(storedCompanies.map((company) => [company.siren, company]));
    const latestScanIndex = await getLatestScanIndex();

    const enrichedResults = await Promise.all(
      results.map(async (company) => {
        const storedCompany = storedIndex.get(company.siren);
        const websiteUrl = storedCompany?.websiteUrl ?? null;
        const rgaaProspectScore = await scoreRgaaProspect(websiteUrl);

        return {
          ...company,
          websiteUrl,
          websiteSource: storedCompany?.websiteSource ?? 'inconnue',
          websiteConfidence: storedCompany?.websiteConfidence ?? 'faible',
          websiteRedesignYear: storedCompany?.websiteRedesignYear ?? null,
          email: storedCompany?.email ?? null,
          eligibility: estimateEligibility(company),
          latestScanStatus: latestScanIndex.get(company.siren)?.status ?? null,
          latestScannedAt: latestScanIndex.get(company.siren)?.scannedAt ?? null,
          rgaaProspectScore,
        };
      }),
    );

    res.json({
      success: true,
      results: enrichedResults,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/recent', async (req, res, next) => {
  const schema = z.object({
    limit: z.coerce.number().int().positive().max(200).optional(),
  });

  try {
    const params = schema.parse(req.query);
    const companies = await listCompanies(params.limit ?? 50);
    const latestScanIndex = await getLatestScanIndex();

    const enrichedCompanies = await Promise.all(
      companies.map(async (company) => ({
        ...company,
        eligibility: estimateEligibility(company),
        latestScanStatus: latestScanIndex.get(company.siren)?.status ?? null,
        latestScannedAt: latestScanIndex.get(company.siren)?.scannedAt ?? null,
        rgaaProspectScore: await scoreRgaaProspect(company.websiteUrl),
      })),
    );

    res.json({
      success: true,
      companies: enrichedCompanies,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:siren', async (req, res, next) => {
  try {
    const company = await getCompanyBySiren(req.params.siren);
    if (!company) {
      res.status(404).json({
        success: false,
        error: 'Entreprise introuvable',
      });
      return;
    }

    await upsertCompaniesFromSearch([company]);
    const stored = await getCompanyFromStorage(company.siren);
    const latestScanIndex = await getLatestScanIndex();

    res.json({
      success: true,
      company: {
        ...company,
        websiteUrl: stored?.websiteUrl ?? null,
        websiteSource: stored?.websiteSource ?? 'inconnue',
        websiteConfidence: stored?.websiteConfidence ?? 'faible',
        websiteRedesignYear: stored?.websiteRedesignYear ?? null,
        email: stored?.email ?? null,
        lastExportedAt: stored?.lastExportedAt ?? null,
        eligibility: estimateEligibility(company),
        latestScanStatus: latestScanIndex.get(company.siren)?.status ?? null,
        latestScannedAt: latestScanIndex.get(company.siren)?.scannedAt ?? null,
        rgaaProspectScore: await scoreRgaaProspect(stored?.websiteUrl ?? null),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/resolve-website', async (req, res, next) => {
  const schema = z.object({
    siren: z.string().length(9),
    manualWebsite: z.string().url().optional().or(z.literal('')),
  });

  try {
    const body = schema.parse(req.body);
    const company = await getCompanyBySiren(body.siren);
    if (!company) {
      res.status(404).json({
        success: false,
        error: 'Entreprise introuvable',
      });
      return;
    }

    let resolution;
    try {
      resolution = await withTimeout(
        resolveWebsite(company, body.manualWebsite || undefined),
        WEBSITE_RESOLUTION_TIMEOUT_MS,
        'La recherche du site a pris trop de temps',
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'La recherche du site a pris trop de temps'
      ) {
        resolution = {
          websiteUrl: null,
          source: 'inconnue' as const,
          confidence: 'faible' as const,
          websiteRedesignYear: null,
          notes: [
            'La recherche automatique du site a ete interrompue pour repondre plus vite.',
          ],
        };
      } else {
        throw error;
      }
    }

    await upsertCompaniesFromSearch([company]);
    await setCompanyWebsite(company.siren, resolution);
    const stored = await getCompanyFromStorage(company.siren);

    let emailNotes: string[] = [];
    let emailSource: 'site' | 'snov' | 'inconnue' = 'inconnue';

    if (resolution.websiteUrl) {
      try {
        const contacts = await withTimeout(
          resolveCompanyEmail(resolution.websiteUrl),
          EMAIL_RESOLUTION_TIMEOUT_MS,
          "La recherche d'email a pris trop de temps",
        );
        emailNotes = contacts.notes;
        emailSource = contacts.source;
        const existingEmail = stored?.email ?? null;
        if (contacts.email && contacts.email !== existingEmail) {
          await setCompanyEmail(company.siren, contacts.email, contacts.source, contacts.notes);
        } else if (!existingEmail && contacts.email) {
          await setCompanyEmail(company.siren, contacts.email, contacts.source, contacts.notes);
        }
      } catch (error) {
        emailNotes = [
          error instanceof Error && error.message === "La recherche d'email a pris trop de temps"
            ? "La recherche d'email a ete interrompue pour repondre plus vite."
            : "La recherche d'email a echoue sur cette tentative.",
        ];
      }
    }

    const storedAfter = await getCompanyFromStorage(company.siren);
    const latestScanIndex = await getLatestScanIndex();

    res.json({
      success: true,
      company: {
        ...company,
        websiteUrl: resolution.websiteUrl,
        websiteSource: resolution.source,
        websiteConfidence: resolution.confidence,
        websiteRedesignYear: storedAfter?.websiteRedesignYear ?? resolution.websiteRedesignYear,
        email: storedAfter?.email ?? null,
        emailSource: storedAfter?.email ? storedAfter.emailSource : emailSource,
        lastExportedAt: storedAfter?.lastExportedAt ?? null,
        eligibility: estimateEligibility(company),
        latestScanStatus: latestScanIndex.get(company.siren)?.status ?? null,
        latestScannedAt: latestScanIndex.get(company.siren)?.scannedAt ?? null,
        rgaaProspectScore: await scoreRgaaProspect(resolution.websiteUrl),
      },
      resolution: {
        ...resolution,
        notes: [
          ...resolution.notes,
          ...emailNotes.map((note) => `Email: ${note}`),
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;

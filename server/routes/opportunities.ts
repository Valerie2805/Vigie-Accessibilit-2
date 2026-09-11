import { Router } from 'express';
import { z } from 'zod';
import { buildOpportunity, refreshOpportunity } from '../services/opportunity-engine.js';
import {
  getCompanyFromStorage,
  getOpportunityById,
  getOpportunityByScanId,
  getScanById,
  listOpportunities,
  listScans,
  markOpportunitiesAsExported,
  saveOpportunity,
  setOpportunityStatus,
} from '../services/storage.js';
import type { OpportunityRecord } from '../types.js';

const router = Router();

async function ensureOpportunityForScan(scanId: string) {
  const existing = await getOpportunityByScanId(scanId);
  if (existing) {
    return existing;
  }

  const scan = await getScanById(scanId);
  if (!scan) {
    return null;
  }

  const company = await getCompanyFromStorage(scan.siren);
  if (!company) {
    return null;
  }

  return saveOpportunity(buildOpportunity(company, scan));
}

async function ensureAllOpportunities() {
  for (const scan of await listScans()) {
    await ensureOpportunityForScan(scan.id);
  }

  return listOpportunities();
}

function toCsv(opportunities: OpportunityRecord[]) {
  const headers = [
    'id',
    'site',
    'domain',
    'country',
    'sector',
    'site_type',
    'lead_score',
    'lead_label',
    'regulatory_urgency',
    'primary_offer',
    'secondary_offer',
    'confidence',
    'status',
    'why_now',
    'email_subject',
  ];

  const escape = (value: string | number | null | undefined) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;

  const lines = opportunities.map((opportunity) =>
    [
      opportunity.id,
      opportunity.site.name,
      opportunity.site.domain,
      opportunity.site.country,
      opportunity.site.sector,
      opportunity.site.siteType,
      opportunity.scores.leadScore,
      opportunity.scores.leadLabel,
      opportunity.scores.regulatoryUrgency,
      opportunity.recommendedOffer.primary,
      opportunity.recommendedOffer.secondary,
      opportunity.scan.confidence,
      opportunity.status,
      opportunity.whyNow,
      opportunity.outreach.emailSubject,
    ]
      .map(escape)
      .join(','),
  );

  return [headers.join(','), ...lines].join('\n');
}

router.post('/export', async (req, res, next) => {
  const schema = z.object({
    ids: z.array(z.string()).min(1),
    format: z.enum(['csv', 'xls']),
  });

  try {
    const body = schema.parse(req.body);
    const exportResult = await markOpportunitiesAsExported(body.ids);
    res.json({
      success: true,
      format: body.format,
      exportedAt: exportResult.exportedAt,
      opportunities: exportResult.opportunities,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export', async (req, res, next) => {
  const schema = z.object({
    format: z.enum(['csv', 'xls']).optional().default('csv'),
    ids: z.string().optional(),
  });

  try {
    const params = schema.parse(req.query);
    const ids = new Set(
      (params.ids ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
    const opportunities = (await ensureAllOpportunities()).filter((opportunity) =>
      ids.size === 0 ? true : ids.has(opportunity.id),
    );

    if (params.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="opportunities.csv"');
      res.send(toCsv(opportunities));
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="opportunities.xls"');
    res.send(toCsv(opportunities));
  } catch (error) {
    next(error);
  }
});

router.get('/', async (_req, res) => {
  res.json({
    success: true,
    opportunities: await ensureAllOpportunities(),
  });
});

router.get('/:opportunityId', async (req, res) => {
  const opportunity =
    (await getOpportunityById(req.params.opportunityId)) ??
    (await ensureOpportunityForScan(req.params.opportunityId.replace(/^opp_/, '')));

  if (!opportunity) {
    res.status(404).json({
      success: false,
      error: 'Opportunite introuvable',
    });
    return;
  }

  res.json({
    success: true,
    opportunity,
  });
});

router.post('/:opportunityId/recompute', async (req, res) => {
  const opportunity = await getOpportunityById(req.params.opportunityId);
  if (!opportunity) {
    res.status(404).json({
      success: false,
      error: 'Opportunite introuvable',
    });
    return;
  }

  if (!opportunity.scanId) {
    res.status(400).json({
      success: false,
      error: 'Aucun scan source disponible pour recalculer cette opportunite',
    });
    return;
  }

  const scan = await getScanById(opportunity.scanId);
  const company = await getCompanyFromStorage(opportunity.siren);
  if (!scan || !company) {
    res.status(404).json({
      success: false,
      error: 'Contexte source introuvable pour recalculer cette opportunite',
    });
    return;
  }

  const refreshed = await saveOpportunity(refreshOpportunity(opportunity, company, scan));
  res.json({
    success: true,
    opportunity: refreshed,
  });
});

router.post('/:opportunityId/generate-outreach', async (req, res) => {
  const opportunity = await getOpportunityById(req.params.opportunityId);
  if (!opportunity) {
    res.status(404).json({
      success: false,
      error: 'Opportunite introuvable',
    });
    return;
  }

  if (!opportunity.scanId) {
    res.status(400).json({
      success: false,
      error: 'Aucun scan source disponible pour regenerer le message',
    });
    return;
  }

  const scan = await getScanById(opportunity.scanId);
  const company = await getCompanyFromStorage(opportunity.siren);
  if (!scan || !company) {
    res.status(404).json({
      success: false,
      error: 'Contexte source introuvable pour regenerer le message',
    });
    return;
  }

  const refreshed = await saveOpportunity(refreshOpportunity(opportunity, company, scan));
  res.json({
    success: true,
    opportunity: refreshed,
  });
});

router.patch('/:opportunityId/status', async (req, res, next) => {
  const schema = z.object({
    status: z.enum(['new', 'reviewed', 'contacted', 'qualified', 'discarded']),
  });

  try {
    const body = schema.parse(req.body);
    const updated = await setOpportunityStatus(req.params.opportunityId, body.status);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Opportunite introuvable',
      });
      return;
    }

    res.json({
      success: true,
      opportunity: updated,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

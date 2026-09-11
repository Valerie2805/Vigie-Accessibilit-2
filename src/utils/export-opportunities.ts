import type { Opportunity } from '@/types';

function downloadFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string | number | null | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildRows(opportunities: Opportunity[]) {
  return opportunities.map((opportunity) =>
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
      opportunity.lastExportedAt,
    ]
      .map(escapeCsv)
      .join(','),
  );
}

export function exportOpportunitiesToCsv(opportunities: Opportunity[], fileName = 'opportunities.csv') {
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
    'last_exported_at',
  ];
  const lines = buildRows(opportunities);
  downloadFile([headers.join(','), ...lines].join('\n'), fileName, 'text/csv;charset=utf-8');
}

export function exportOpportunitiesToXls(opportunities: Opportunity[], fileName = 'opportunities.xls') {
  const headers = [
    'ID',
    'Site',
    'Domaine',
    'Pays',
    'Secteur',
    'Type de site',
    'Lead score',
    'Label',
    'Urgence',
    'Offre principale',
    'Offre secondaire',
    'Confiance',
    'Statut',
    'Derniere exportation',
  ];

  const rows = opportunities
    .map((opportunity) =>
      [
        opportunity.id,
        opportunity.site.name,
        opportunity.site.domain ?? '',
        opportunity.site.country,
        opportunity.site.sector ?? '',
        opportunity.site.siteType,
        String(opportunity.scores.leadScore),
        opportunity.scores.leadLabel,
        opportunity.scores.regulatoryUrgency,
        opportunity.recommendedOffer.primary,
        opportunity.recommendedOffer.secondary ?? '',
        opportunity.scan.confidence,
        opportunity.status,
        opportunity.lastExportedAt ?? '',
      ]
        .map((value) => `<td>${String(value ?? '')}</td>`)
        .join(''),
    )
    .map((cells) => `<tr>${cells}</tr>`)
    .join('');

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
      </head>
      <body>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;

  downloadFile(html, fileName, 'application/vnd.ms-excel;charset=utf-8');
}

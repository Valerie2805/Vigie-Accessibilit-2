import { extractContacts } from './contact-extractor.js';
import { findCompanyEmailsWithSnov } from './snov-email-finder.js';

export type CompanyEmailResolution = {
  email: string | null;
  source: 'site' | 'snov' | 'inconnue';
  notes: string[];
};

export async function resolveCompanyEmailFromSiteOnly(
  websiteUrl: string,
): Promise<CompanyEmailResolution> {
  const contacts = await extractContacts(websiteUrl);
  if (contacts.email) {
    return {
      email: contacts.email,
      source: 'site',
      notes: contacts.notes,
    };
  }

  return {
    email: null,
    source: 'inconnue',
    notes: [
      ...contacts.notes,
      "Aucun email n'a ete trouve directement sur le site.",
    ],
  };
}

export async function resolveCompanyEmail(
  websiteUrl: string,
): Promise<CompanyEmailResolution> {
  const contacts = await resolveCompanyEmailFromSiteOnly(websiteUrl);
  if (contacts.email) {
    return contacts;
  }

  const snov = await findCompanyEmailsWithSnov(websiteUrl);
  if (snov.email) {
    return {
      email: snov.email,
      source: 'snov',
      notes: snov.notes,
    };
  }

  return {
    email: null,
    source: 'inconnue',
    notes: [...contacts.notes, ...snov.notes],
  };
}

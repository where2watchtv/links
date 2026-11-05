// Pure functions shared by the link checker, the issue handler and the index
// build. No I/O here, so every rule a link lives by can be tested directly.

export const KINDS = [
  ['flatrate', 'Stream'],
  ['free', 'Free'],
  ['ads', 'Free with ads'],
  ['rent', 'Rent'],
  ['buy', 'Buy'],
];
export const KIND_IDS = KINDS.map(([k]) => k);
export const TYPES = ['movie', 'tv'];

/* The same rule thesubtitledb.org and where2watch.ch use. */
export const slugify = (s, n = 60) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+/, '').slice(0, n).replace(/-+$/, '');

export const isImdb = (s) => /^tt\d{7,10}$/.test(String(s || ''));
export const isTmdb = (s) => /^[1-9]\d{0,9}$/.test(String(s || ''));

/* Each title with links has a folder, titles/{type}/{tmdb}-{slug}/links.json,
   so the repository reads as a list of titles. Only the id part is load-bearing. */
export const folderName = (tmdb, name) => {
  const s = slugify(name || '', 40);
  return `${tmdb}${s ? '-' + s : ''}`;
};
export const folderId = (folder) => {
  const m = /^([1-9]\d{0,9})(?:-[a-z0-9-]+)?$/.exec(folder);
  return m ? Number(m[1]) : 0;
};

/** services.json: [{ name, hosts: ["netflix.com", ...] }]. A host matches itself and its subdomains. */
export function serviceFor(url, services) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  for (const s of services) {
    if (s.hosts.some((h) => host === h || host.endsWith('.' + h))) return s;
  }
  return null;
}

const COUNTRY = /^[A-Z]{2}$/;

/**
 * Checks one submitted link. Returns { ok: true, link } with the link in its
 * stored shape, or { ok: false, error } in words a submitter can act on.
 */
export function checkLink(input, services, existing = []) {
  const url = String(input.url || '').trim();
  let u;
  try { u = new URL(url); } catch { return { ok: false, error: 'The link is not a valid web address.' }; }
  if (u.protocol !== 'https:') return { ok: false, error: 'The link must start with https://.' };
  if (u.username || u.password) return { ok: false, error: 'The link must not contain a username or password.' };
  const service = serviceFor(url, services);
  if (!service) {
    return { ok: false, error: `${u.hostname} is not on the list of licensed services (services.json). Open a pull request to add it if it is one.` };
  }
  const country = String(input.country || '').trim().toUpperCase();
  if (!COUNTRY.test(country)) return { ok: false, error: 'The country must be a two-letter code, such as GB or DE.' };
  if (country === 'US') return { ok: false, error: 'Links for the United States are not accepted.' };
  const kind = String(input.kind || '').trim();
  if (!KIND_IDS.includes(kind)) return { ok: false, error: `The kind must be one of: ${KIND_IDS.join(', ')}.` };
  const note = String(input.note || '').trim().slice(0, 140);
  const clean = u.toString();
  if (existing.some((l) => l.url === clean && l.country === country)) {
    return { ok: false, error: 'That link is already listed for that country.' };
  }
  const link = { service: service.name, url: clean, country, kind };
  if (note) link.note = note;
  return { ok: true, link };
}

/** GitHub issue forms write "### Label\n\nvalue" blocks; "_No response_" means empty. */
export function parseIssueForm(body) {
  const out = {};
  const parts = String(body || '').split(/^### /m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const label = p.slice(0, nl).trim();
    let value = p.slice(nl + 1).trim();
    if (value === '_No response_') value = '';
    out[label] = value;
  }
  return out;
}

/** Turns the issue form's fields into a lookup and a link. */
export function issueRequest(fields) {
  const id = String(fields['Title id'] || '').trim();
  const type = String(fields['Type'] || '').trim().toLowerCase();
  const kindLabel = String(fields['Kind'] || '').trim();
  const kind = (KINDS.find(([, l]) => l.toLowerCase() === kindLabel.toLowerCase()) || [kindLabel])[0];
  const country = String(fields['Country'] || '').trim().split(/\s/)[0];
  return {
    id, type,
    link: { url: fields['Link'], country, kind, note: fields['Note'] },
  };
}

/**
 * The file where2watch.ch reads: { generated, titles: { "movie:603": [links] } }.
 * docs is [{ type, folder, doc }] as read from titles/.
 */
export function buildIndex(docs, generated = new Date().toISOString()) {
  const titles = {};
  for (const { type, folder, doc } of docs) {
    const id = folderId(folder);
    if (id && doc.links.length) titles[`${type}:${id}`] = doc.links;
  }
  return { generated, titles: Object.fromEntries(Object.entries(titles).sort(([a], [b]) => a.localeCompare(b))) };
}

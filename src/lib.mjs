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

/* A player is one address for every title, with the title's id in it:
   https://player.example/embed/{tmdb} or .../{imdb}, and {type} (movie or tv) if
   the service needs it. A TV player for one episode holds {season} and {episode}
   too: https://player.example/tv/{tmdb}/{season}/{episode}. where2watch plays it
   inside its own page, in a sandboxed frame. Its name is the one given, else the
   name services.json has for its host, else the host. */
const SLOTS = ['{tmdb}', '{imdb}', '{type}', '{season}', '{episode}'];
export const PLAYER_TYPES = { movie: ['movie'], tv: ['tv'], both: ['movie', 'tv'] };

/** Checks one submitted player. Returns { ok: true, player } or { ok: false, error }. */
export function checkPlayer(input, services, existing = []) {
  const url = String(input.url || '').trim();
  const slots = url.match(/\{[^}]*\}/g) || [];
  const ids = slots.filter((x) => x === '{tmdb}' || x === '{imdb}');
  if (ids.length !== 1 || slots.some((x) => !SLOTS.includes(x)) || slots.length !== new Set(slots).size) {
    return { ok: false, error: 'The address must hold exactly one of {tmdb} or {imdb}, and may hold {type}, {season} and {episode} once each.' };
  }
  const episodic = slots.includes('{season}') || slots.includes('{episode}');
  if (episodic && !(slots.includes('{season}') && slots.includes('{episode}'))) {
    return { ok: false, error: 'An episode address holds both {season} and {episode}.' };
  }
  if (episodic && (slots.includes('{type}') || String(input.type || '').trim() !== 'tv')) {
    return { ok: false, error: 'An address with {season} and {episode} is for TV series only: type tv, without {type}.' };
  }
  let u;
  try { u = new URL(url.replace(/\{(tmdb|imdb|type|season|episode)\}/g, 'w2wslot')); } catch { return { ok: false, error: 'The address is not a valid web address.' }; }
  if (u.protocol !== 'https:') return { ok: false, error: 'The address must start with https://.' };
  if (u.username || u.password) return { ok: false, error: 'The address must not contain a username or password.' };
  if (u.hostname.includes('w2wslot')) return { ok: false, error: 'The id goes in the path or the query, not the host name.' };
  const service = serviceFor(u.toString(), services);
  const name = String(input.service || '').trim().slice(0, 60) || service?.name || u.hostname;
  const country = String(input.country || '').trim().toUpperCase();
  if (!COUNTRY.test(country)) return { ok: false, error: 'The country must be a two-letter code, such as GB or DE.' };
  if (country === 'US') return { ok: false, error: 'Players for the United States are not accepted.' };
  const kind = String(input.kind || '').trim();
  if (!KIND_IDS.includes(kind)) return { ok: false, error: `The kind must be one of: ${KIND_IDS.join(', ')}.` };
  const type = slots.includes('{type}') ? 'both' : String(input.type || '').trim();
  if (!PLAYER_TYPES[type]) return { ok: false, error: 'The type must be movie, tv or both.' };
  if (existing.some((p) => p.url === url && p.country === country)) return { ok: false, error: 'That player is already listed for that country.' };
  return { ok: true, player: { service: name, url, id: ids[0].slice(1, -1), country, kind, types: PLAYER_TYPES[type] } };
}

/** The "Add a player" form's fields as a player to check. */
export function playerRequest(fields) {
  const kindLabel = String(fields['Kind'] || '').trim();
  return {
    url: fields['Player address'],
    type: { film: 'movie', 'tv series': 'tv', both: 'both' }[String(fields['Type'] || '').trim().toLowerCase()] || '',
    country: String(fields['Country'] || '').trim().split(/\s/)[0],
    kind: (KINDS.find(([, l]) => l.toLowerCase() === kindLabel.toLowerCase()) || [kindLabel])[0],
  };
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
 * The file where2watch.ch reads: { generated, titles: { "movie:603": [links] }, players: [...] }.
 * docs is [{ type, folder, doc }] as read from titles/; players is players.json's list.
 */
export function buildIndex(docs, players = [], generated = new Date().toISOString()) {
  const titles = {};
  for (const { type, folder, doc } of docs) {
    const id = folderId(folder);
    if (id && doc.links.length) titles[`${type}:${id}`] = doc.links;
  }
  return { generated, titles: Object.fromEntries(Object.entries(titles).sort(([a], [b]) => a.localeCompare(b))), players };
}

/**
 * The player workflow's change to players.json: add a service's film and TV
 * addresses (each checked like a submitted player) in each country given
 * ("VN, TH" adds one player per country), or remove every player with that
 * service name.
 */
export function editPlayers(players, services, { action = 'add', service, movie, tv, country, kind }) {
  const name = String(service || '').trim();
  if (!name) return { ok: false, error: 'A service name is needed.' };
  if (action === 'remove') {
    const left = players.filter((p) => p.service !== name);
    return left.length === players.length ? { ok: false, error: `No player is named ${name}.` } : { ok: true, players: left };
  }
  if (action !== 'add') return { ok: false, error: 'The action must be add or remove.' };
  const pairs = [['movie', movie], ['tv', tv]].filter(([, u]) => String(u || '').trim());
  if (!pairs.length) return { ok: false, error: 'Give a film address, a TV address, or both.' };
  const out = players.slice();
  const countries = String(country || '').split(/[\s,]+/).filter(Boolean);
  for (const cc of countries.length ? countries : ['']) {
    for (const [type, url] of pairs) {
      const r = checkPlayer({ service: name, url: String(url).trim(), type, country: cc, kind }, services, out);
      if (!r.ok) return { ok: false, error: `${type}${cc ? ` in ${cc}` : ''}: ${r.error}` };
      out.push(r.player);
    }
  }
  return { ok: true, players: out };
}

// Turns an "Add a link" issue into a change to titles/. Run by
// .github/workflows/link-issue.yml with the issue event; it writes the
// links.json file and .link-result.json, which the workflow turns into a pull
// request and a comment. The issue body is untrusted: it only ever reaches
// checkLink and JSON, never a shell.
//
//   GITHUB_EVENT_PATH=event.json TMDB_API_KEY=... node src/issue.mjs
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLink, checkPlayer, folderId, folderName, isImdb, isTmdb, issueRequest, parseIssueForm, playerRequest, TYPES } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = process.env.TMDB_API_KEY;
const out = (r) => writeFile(join(ROOT, '.link-result.json'), JSON.stringify(r));

async function tmdb(path) {
  const r = await fetch(`https://api.themoviedb.org/3/${path}${path.includes('?') ? '&' : '?'}api_key=${KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`TMDB answered ${r.status}`);
  return r.json();
}

/** Resolves the form's id to { type, tmdb, name }, or a reason it could not. */
async function resolve(id, type) {
  if (isImdb(id)) {
    const f = await tmdb(`find/${id}?external_source=imdb_id`);
    const hit = f?.movie_results?.[0] ? ['movie', f.movie_results[0]] : f?.tv_results?.[0] ? ['tv', f.tv_results[0]] : null;
    if (!hit) return { error: `TMDB has no film or series with IMDb id ${id}.` };
    return { type: hit[0], tmdb: hit[1].id, name: hit[1].title || hit[1].name, year: (hit[1].release_date || hit[1].first_air_date || '').slice(0, 4) };
  }
  if (isTmdb(id)) {
    if (!TYPES.includes(type)) return { error: 'A TMDB id needs a type: Film or TV series.' };
    const d = await tmdb(`${type}/${id}`);
    if (!d) return { error: `TMDB has no ${type === 'tv' ? 'TV series' : 'film'} with id ${id}.` };
    return { type, tmdb: d.id, name: d.title || d.name, year: (d.release_date || d.first_air_date || '').slice(0, 4) };
  }
  return { error: 'The title id must be an IMDb id (tt0903747) or a TMDB id (1396).' };
}

const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));

/* An "Add a player" issue: one address for every title, added to players.json. */
if ((event.issue?.labels || []).some((l) => l.name === 'player')) {
  const services = JSON.parse(await readFile(join(ROOT, 'services.json'), 'utf8'));
  const file = join(ROOT, 'players.json');
  const doc = JSON.parse(await readFile(file, 'utf8'));
  const r = checkPlayer(playerRequest(parseIssueForm(event.issue.body)), services, doc.players);
  if (!r.ok) {
    await out({ ok: false, message: r.error });
    process.exit(0);
  }
  doc.players.push(r.player);
  await writeFile(file, JSON.stringify(doc, null, 2) + '\n');
  const p = r.player;
  await out({
    ok: true,
    path: 'players.json',
    summary: `Player: ${p.service} (${p.kind}, ${p.country})`,
    message: `Added the ${p.service} player for ${p.country}. A maintainer will review the pull request.`,
  });
  process.exit(0);
}

const req = issueRequest(parseIssueForm(event.issue?.body));
req.type = { film: 'movie', 'tv series': 'tv' }[req.type] || req.type;

const title = await resolve(req.id, req.type);
if (title.error) {
  await out({ ok: false, message: title.error });
  process.exit(0);
}

const services = JSON.parse(await readFile(join(ROOT, 'services.json'), 'utf8'));
const dir = join(ROOT, 'titles', title.type);
const folder = (await readdir(dir).catch(() => [])).find((f) => folderId(f) === title.tmdb) || folderName(title.tmdb, title.name);
const file = join(dir, folder, 'links.json');
const label = `${title.name}${title.year ? ` (${title.year})` : ''}`;
const doc = JSON.parse(await readFile(file, 'utf8').catch(() => 'null')) || { title: label, links: [] };

const r = checkLink(req.link, services, doc.links);
if (!r.ok) {
  await out({ ok: false, message: r.error });
  process.exit(0);
}
doc.links.push(r.link);
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(doc, null, 2) + '\n');
await out({
  ok: true,
  path: `titles/${title.type}/${folder}/links.json`,
  summary: `${r.link.service} (${r.link.kind}, ${r.link.country}) for ${label}`,
  message: `Added ${r.link.service} for ${label} in ${r.link.country}. A maintainer will review the pull request.`,
});

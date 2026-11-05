// Checks every titles/{type}/{folder}/links.json against the rules in
// lib.mjs. Runs in CI on every pull request; exits non-zero on the first
// problem list so a bad link never reaches the site.
//
//   node src/check.mjs
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLink, folderId, TYPES } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const services = JSON.parse(await readFile(join(ROOT, 'services.json'), 'utf8'));
const problems = [];
let files = 0, total = 0;

for (const s of services) {
  if (!s.name || !Array.isArray(s.hosts) || !s.hosts.length) problems.push(`services.json: bad entry ${JSON.stringify(s)}`);
}

const seen = new Set();
for (const type of TYPES) {
  const dir = join(ROOT, 'titles', type);
  let folders = [];
  try { folders = await readdir(dir); } catch { continue; }
  for (const folder of folders) {
    const where = `titles/${type}/${folder}`;
    if (!(await stat(join(dir, folder))).isDirectory()) { problems.push(`${where}: not a folder`); continue; }
    const id = folderId(folder);
    if (!id) { problems.push(`${where}: folder must be named {tmdb id} or {tmdb id}-{slug}`); continue; }
    if (seen.has(`${type}:${id}`)) { problems.push(`${where}: a second folder for ${type} ${id}`); continue; }
    seen.add(`${type}:${id}`);
    let doc;
    try { doc = JSON.parse(await readFile(join(dir, folder, 'links.json'), 'utf8')); } catch (e) {
      problems.push(`${where}/links.json: ${e.code === 'ENOENT' ? 'missing' : 'not valid JSON'}`);
      continue;
    }
    files++;
    if (!doc || typeof doc.title !== 'string' || !Array.isArray(doc.links)) {
      problems.push(`${where}/links.json: must be { "title": "...", "links": [...] }`);
      continue;
    }
    const ok = [];
    doc.links.forEach((l, i) => {
      total++;
      const r = checkLink(l || {}, services, ok);
      if (!r.ok) return problems.push(`${where}/links.json link ${i + 1}: ${r.error}`);
      if (r.link.service !== l.service) problems.push(`${where}/links.json link ${i + 1}: service should be "${r.link.service}"`);
      ok.push(r.link);
    });
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`ok: ${total} links in ${files} titles, ${services.length} services`);

// Writes links.json, the one file where2watch.ch reads, from every
// titles/{type}/{folder}/links.json. Run on main after each merge; check.mjs
// has already passed, so a broken file here is an error, not a skip.
//
//   node src/index.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, TYPES } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = [];
for (const type of TYPES) {
  const folders = await readdir(join(ROOT, 'titles', type)).catch(() => []);
  for (const folder of folders) {
    docs.push({ type, folder, doc: JSON.parse(await readFile(join(ROOT, 'titles', type, folder, 'links.json'), 'utf8')) });
  }
}
const index = buildIndex(docs);
await writeFile(join(ROOT, 'links.json'), JSON.stringify(index, null, 1) + '\n');
console.log(`links.json: ${Object.keys(index.titles).length} titles`);

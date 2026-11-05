// Adds or removes a player in players.json. Run by .github/workflows/player.yml
// with the form's inputs in INPUT_* variables; they reach editPlayers and JSON,
// never a shell. Exits non-zero, with the reason, when nothing was changed.
//
//   INPUT_SERVICE=Example INPUT_MOVIE='https://p.example/movie/{tmdb}' INPUT_COUNTRY=GB INPUT_KIND=free node src/player.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { editPlayers } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = (k) => process.env[`INPUT_${k}`] || '';
const file = join(ROOT, 'players.json');
const doc = JSON.parse(await readFile(file, 'utf8'));
const services = JSON.parse(await readFile(join(ROOT, 'services.json'), 'utf8'));
const r = editPlayers(doc.players, services, {
  action: env('ACTION') || 'add', service: env('SERVICE'), movie: env('MOVIE'), tv: env('TV'), country: env('COUNTRY'), kind: env('KIND'),
});
if (!r.ok) {
  console.error(r.error);
  process.exit(1);
}
await writeFile(file, JSON.stringify({ ...doc, players: r.players }, null, 1) + '\n');
console.log(`players.json: ${doc.players.length} -> ${r.players.length} players`);

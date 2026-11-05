import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildIndex, checkLink, folderId, folderName, issueRequest, parseIssueForm, serviceFor, slugify,
} from '../src/lib.mjs';

const services = JSON.parse(readFileSync(new URL('../services.json', import.meta.url)));

test('slugify matches TSDB addresses', () => {
  assert.equal(slugify('The Matrix'), 'the-matrix');
  assert.equal(slugify("Ocean's Eleven"), 'oceans-eleven');
  assert.equal(slugify('Amélie'), 'amelie');
});

test('folders are named by tmdb id, slug optional', () => {
  assert.equal(folderName(603, 'The Matrix'), '603-the-matrix');
  assert.equal(folderId('603-the-matrix'), 603);
  assert.equal(folderId('603'), 603);
  assert.equal(folderId('the-matrix'), 0);
  assert.equal(folderId('0603'), 0);
});

test('only allowlisted hosts and their subdomains count', () => {
  assert.equal(serviceFor('https://www.netflix.com/title/1', services).name, 'Netflix');
  assert.equal(serviceFor('https://netflix.com.evil.example/x', services), null);
  assert.equal(serviceFor('https://evilnetflix.com/x', services), null);
});

test('checkLink accepts a good link and rejects the rest', () => {
  const good = { url: 'https://www.netflix.com/title/70143836', country: 'gb', kind: 'flatrate', note: ' 4K ' };
  const r = checkLink(good, services);
  assert.deepEqual(r, { ok: true, link: { service: 'Netflix', url: 'https://www.netflix.com/title/70143836', country: 'GB', kind: 'flatrate', note: '4K' } });
  assert.equal(checkLink({ ...good, url: 'http://www.netflix.com/x' }, services).ok, false);
  assert.equal(checkLink({ ...good, url: 'https://u:p@www.netflix.com/x' }, services).ok, false);
  assert.equal(checkLink({ ...good, url: 'https://piratebay.example/x' }, services).ok, false);
  assert.equal(checkLink({ ...good, url: 'javascript:alert(1)' }, services).ok, false);
  assert.equal(checkLink({ ...good, country: 'GBR' }, services).ok, false);
  assert.equal(checkLink({ ...good, kind: 'torrent' }, services).ok, false);
  assert.equal(checkLink(good, services, [r.link]).ok, false, 'duplicate');
  assert.equal(checkLink({ ...good, country: 'us' }, services).ok, false, 'no links for the US');
});

test('issue form fields become a request', () => {
  const body = '### Title id\n\ntt0903747\n\n### Type\n\nTV series\n\n### Link\n\nhttps://www.netflix.com/title/70143836\n\n### Country\n\nGB (United Kingdom)\n\n### Kind\n\nFree with ads\n\n### Note\n\n_No response_';
  const req = issueRequest(parseIssueForm(body));
  assert.equal(req.id, 'tt0903747');
  assert.equal(req.type, 'tv series');
  assert.deepEqual(req.link, { url: 'https://www.netflix.com/title/70143836', country: 'GB', kind: 'ads', note: '' });
});

test('the index keys links by type and tmdb id, and skips empty titles', () => {
  const link = { service: 'Netflix', url: 'https://www.netflix.com/title/1', country: 'GB', kind: 'flatrate' };
  const idx = buildIndex([
    { type: 'tv', folder: '1396-breaking-bad', doc: { title: 'Breaking Bad', links: [link] } },
    { type: 'movie', folder: '603', doc: { title: 'The Matrix', links: [link] } },
    { type: 'movie', folder: '604-x', doc: { title: 'X', links: [] } },
  ], 'T');
  assert.deepEqual(idx, { generated: 'T', titles: { 'movie:603': [link], 'tv:1396': [link] } });
});

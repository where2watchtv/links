# where2watch links

Direct links to films and TV series on licensed streaming services, added by the community and shown on [where2watch.ch](https://where2watch.ch).

To add one, open an issue with the [Add a link](../../issues/new?template=add-link.yml) form. See [CONTRIBUTING.md](CONTRIBUTING.md).

| Path | What |
|---|---|
| `titles/{movie,tv}/{tmdb id}-{slug}/links.json` | One title's links |
| `services.json` | Licensed services a link may point to |
| `links.json` | Every title's links in one file, rebuilt on each merge. where2watch.ch reads this. |

Checks: `npm test` and `npm run check`.

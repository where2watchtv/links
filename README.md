# where2watch links

Direct links to films and TV series on licensed streaming services, added by the community and shown on [where2watch.ch](https://where2watch.ch).

To add one, open an issue with the [Add a link](../../issues/new?template=add-link.yml) form. A licensed service whose player may be shown inside where2watch can be added once for every title with the [Add a player](../../issues/new?template=add-player.yml) form: its address holds the title's {tmdb} or {imdb} id, and for a TV episode {season} and {episode} too, such as https://player.example/tv/{tmdb}/{season}/{episode}. See [CONTRIBUTING.md](CONTRIBUTING.md).

| Path | What |
|---|---|
| `titles/{movie,tv}/{tmdb id}-{slug}/links.json` | One title's links |
| `players.json` | Players: one address per service and country, with the title's id in it |
| `services.json` | Licensed services a link may point to; `"player": true` marks one that agreed to be played inside where2watch |
| `links.json` | Every title's links in one file, rebuilt on each merge. where2watch.ch reads this. |

Checks: `npm test` and `npm run check`.

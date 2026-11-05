# Adding a link

Open an issue with the **Add a link** form. Give the IMDb or TMDB id, the link, the country it works in and whether it streams, rents or sells the title. A bot checks the link and opens a pull request. A maintainer merges it, and where2watch.ch shows it within about 20 minutes.

A link is accepted only if:

- it starts with `https://`
- its host is a licensed service in `services.json`, or a subdomain of one
- its country is one of VN, PH, ID, TH, MY, HK, TW, SG, RU, TR
- it is not already listed for that country

To add a service, open a pull request that adds it to `services.json`.

You can also edit `titles/` directly in a pull request. Each title has one folder:

```
titles/movie/603-the-matrix/links.json
```

```json
{
  "title": "The Matrix (1999)",
  "links": [
    { "service": "Netflix", "url": "https://www.netflix.com/title/20557937", "country": "VN", "kind": "flatrate" }
  ]
}
```

`kind` is one of `flatrate`, `free`, `ads`, `rent` or `buy`. `note` is optional, up to 140 characters. Run `npm run check` before opening the pull request.

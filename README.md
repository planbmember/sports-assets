# sports-assets

Static sports assets (sport icons, team/league logos) packaged for serving via the jsDelivr CDN.

## CDN URL

```text
# GitHub path (tag-pinned)
https://cdn.jsdelivr.net/gh/planbmember/sports-assets@v<semver>/<path>

# npm path (version-pinned)
https://cdn.jsdelivr.net/npm/sports-assets@<semver>/<path>
```

Pinning a version gives immutable, long-lived caching. `@latest`/`@main` are forbidden in consuming services because of cache-invalidation issues.

## Layout

- `sport-icons/` — sport icons (SVG)
- `team-logos/` — club logos
- `league-logos/` — league logos
- `manifest.json` — entity code → file path + `source`/`license` (required)

## manifest.json schema

```json
{
  "version": "0.1.0",
  "sportIcons": { "soccer": { "file": "sport-icons/soccer.svg", "source": "…", "license": "…" } },
  "teamLogos": { "…": { "file": "team-logos/….webp", "source": "thesportsdb|naver", "license": "…" } },
  "leagueLogos": { "…": { "file": "league-logos/….png", "source": "thesportsdb", "license": "…" } }
}
```

## Flags are not here

Flags reference existing public packages directly (no repackaging needed):

```text
Rectangular: https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/{cc}.svg
Circular:    https://cdn.jsdelivr.net/gh/hatscripts/circle-flags@2.8.0/flags/{cc}.svg
```

`{cc}` = ISO 3166-1 alpha-2, lowercase. Consuming services follow richlabel's `flags.ts` helper conventions.

## License

Package code/manifest is MIT. Copyright and trademark rights of individual assets follow the
`source`/`license` of each `manifest.json` entry — assets with unclear redistribution rights are marked `"license": "reference-only"`.

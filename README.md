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

- `team-logos/<sport>/<league-slug>/<club-slug>.png` — club logos. When a naver emblem
  exists it is the primary (no suffix); the TheSportsDB badge is kept as an alternate
  with a `.<source>.png` suffix. Images are kept as-is (PNG, max 200px) — they are
  already small, so recompressing/resizing would only lose quality.
- `league-logos/` — league logos (none yet)
- `manifest.json` — entity code → file path + `source`/`license` (required)

## Sport icons are not here

Sport icons are not repackaged; reference `@material-symbols/svg-400` (Apache-2.0)
directly via jsDelivr:

```text
https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@0.48.0/outlined/{icon}.svg
```

`{icon}` = Material Symbols icon name (e.g. `sports_soccer`, `sports_baseball`).
The sport code → icon name mapping is owned by the consuming service (richlabel `src/lib/assets.ts`).

## manifest.json schema

```json
{
  "version": "0.1.0",
  "sportIcons": {},
  "teamLogos": {
    "baseball/kbo/kia-tigers": {
      "file": "team-logos/baseball/kbo/kia-tigers.png",
      "source": "naver",
      "license": "reference-only",
      "richlabelTeamIds": [43, 657],
      "alternate": { "file": "team-logos/baseball/kbo/kia-tigers.sportsdb.png", "source": "thesportsdb", "license": "reference-only" }
    }
  },
  "leagueLogos": {}
}
```

After `scripts/build-team-logos.mjs` (richlabel pilot → import/regenerate manifest),
run `npm run check` (`scripts/check-manifest.mjs`) to verify files ↔ manifest consistency.

## Flags are not here

Flags reference existing public packages directly (no repackaging needed):

```text
Rectangular: https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/{cc}.svg
Circular:    https://cdn.jsdelivr.net/gh/hatscripts/circle-flags@2.8.0/flags/{cc}.svg
```

`{cc}` = ISO 3166-1 alpha-2, lowercase. Consuming services follow richlabel's `flags.ts` helper conventions.

## Releases (GHA only — no local publish)

Pushes/tags are handled by GitHub Actions. Do not run `npm publish` locally.

- PR / push to main → `ci` workflow runs `npm run check` (manifest consistency)
- push a `v*` tag → `publish` workflow runs `npm publish --provenance`
  (requires secret `NPM_TOKEN` = npm automation token, human-gated)
- To republish the current main without a tag, manually dispatch `publish` from the Actions tab

## License

Package code/manifest is MIT. Copyright and trademark rights of individual assets follow the
`source`/`license` of each `manifest.json` entry — assets with unclear redistribution rights are marked `"license": "reference-only"`.

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

- `team-logos/<sport>/<league-slug>/<club-slug>.webp` — club logos. When a naver emblem
  exists it is the primary (no suffix); the TheSportsDB badge is kept as an alternate
  with a `.<source>.webp` suffix. All raster images are **lossless WebP** (org rule:
  raster assets in this package are WebP; SVG stays SVG). Conversion happens at import
  time in `scripts/build-team-logos.mjs` (sharp, `webp({ lossless: true })`) — visible
  pixels are identical to the PNG sources, at ~35% smaller size. (libwebp normalizes
  the RGB values of fully transparent pixels; nothing visible changes.)
- `league-logos/` — league logos (none yet)
- `archive/<source>/<asset-kind>/...` (e.g. `archive/naver/team-logos/baseball/kbo/kia-tigers.webp`,
  `archive/polymarket/sport-icons/soccer.svg`) — **per-source provenance archive**.
  Every file collected from a source is kept here in its original collected form,
  including variants that are not in the representative set (dropped alternates,
  mismatches). Append-only: imports overwrite identical paths but never wipe the
  tree. This is how an admin answers "which source did this asset come from?" —
  the path is the provenance. Manifest section: `archive`.
- `sport-icons/<slug>.svg|webp` — **the representative set of sport icons confirmed
  by richlabel** (currently the 25 polymarket graphics, NFL through Esports). Only
  richlabel-confirmed representatives live here; the full set collected from each
  source is preserved separately under `archive/<source>/sport-icons/` (see above).
  Source: Polymarket's sports navigation (`polymarket.com/sports` sidebar).
  Generic sport pictograms are SVG with the light-theme color baked into a root
  `color` attribute (kept as `fill="currentColor"`, so inline consumers can
  recolor via CSS); branded league marks (NFL/MLB/CFB/UFC/UCL) are raster and
  stored as **lossless WebP** like the rest. All `source: "polymarket"`,
  `license: "reference-only"` — display-only, league trademarks apply.
  Slugs and display labels: `manifest.json` `sportIcons`.
- `manifest.json` — entity code → file path + `source`/`license` (required)

## Generic sport icons are not here

Generic sport icons are not repackaged; reference `@material-symbols/svg-400`
(Apache-2.0) directly via jsDelivr:

```text
https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@0.48.0/outlined/{icon}.svg
```

`{icon}` = Material Symbols icon name (e.g. `sports_soccer`, `sports_baseball`).
The sport code → icon name mapping is owned by the consuming service (richlabel `src/lib/assets.ts`).
Use `sport-icons/` only when the Polymarket-style branded graphic is wanted;
for neutral UI iconography, Material Symbols stays the default.

## manifest.json schema

```json
{
  "version": "0.5.0",
  "sportIcons": {
    "soccer": {
      "file": "sport-icons/soccer.svg",
      "label": "Soccer",
      "source": "polymarket",
      "license": "reference-only"
    }
  },
  "teamLogos": {
    "baseball/kbo/kia-tigers": {
      "file": "team-logos/baseball/kbo/kia-tigers.webp",
      "source": "naver",
      "license": "reference-only",
      "richlabelTeamIds": [43, 657],
      "alternate": { "file": "team-logos/baseball/kbo/kia-tigers.sportsdb.webp", "source": "thesportsdb", "license": "reference-only" }
    }
  },
  "leagueLogos": {},
  "archive": {
    "naver/team-logos/baseball/kbo/kia-tigers": {
      "file": "archive/naver/team-logos/baseball/kbo/kia-tigers.webp",
      "source": "naver",
      "license": "reference-only"
    }
  }
}
```

After `scripts/build-team-logos.mjs` (richlabel pilot → archive per source + regenerate
representative set + manifest), run `npm run check` (`scripts/check-manifest.mjs`) to
verify files ↔ manifest consistency.

## Flags are not here

Flags reference existing public packages directly (no repackaging needed):

```text
Rectangular: https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/{cc}.svg
Circular:    https://cdn.jsdelivr.net/gh/hatscripts/circle-flags@2.8.0/flags/{cc}.svg
```

`{cc}` = ISO 3166-1 alpha-2, lowercase. Consuming services follow richlabel's `flags.ts` helper conventions.

## Importing new logos (GHA — no local ImageMagick)

Conversion runs in GitHub Actions, not on a local machine:

1. Copy the richlabel pilot directory (`assets/team-logos/pilot`, containing
   `manifest.json`) into this repo (default path: `pilot/`), commit, push to main.
2. Actions tab → `import` workflow → Run workflow (set `pilot-dir` if you used a
   different path). It runs `scripts/build-team-logos.mjs` + `npm run check`, deletes
   the pilot directory again, and commits the converted WebP files — per-source
   `archive/<source>/...` plus the regenerated `team-logos/` representative set —
   and `manifest.json` back to main with `[skip ci]`.
3. Verify the import commit, then release as below.

Local fallback: `npm ci && npm run build:team-logos -- <pilot-dir>` needs only Node —
sharp ships prebuilt binaries, no system ImageMagick.

## Releases (GHA only — no local publish)

Pushes/tags are handled by GitHub Actions. Do not run `npm publish` locally.

- PR / push to main → `ci` workflow runs `npm run check` (manifest consistency)
- push a `v*` tag → `publish` workflow runs `npm publish` via npm trusted publishing (OIDC)
- To republish the current main without a tag, manually dispatch `publish` from the Actions tab

## License

Package code/manifest is MIT. Copyright and trademark rights of individual assets follow the
`source`/`license` of each `manifest.json` entry — assets with unclear redistribution rights are marked `"license": "reference-only"`.

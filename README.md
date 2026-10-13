# sports-assets

Static sports assets (sport icons, league/team logos, athlete images).

## CDN URL

```text
# GitHub path (tag-pinned)
https://cdn.jsdelivr.net/gh/planbmember/sports-assets@v<semver>/<path>

# npm path (version-pinned)
https://cdn.jsdelivr.net/npm/sports-assets@<semver>/<path>
```

Pinning a version gives immutable, long-lived caching. `@latest`/`@main` are forbidden in consuming services because of cache-invalidation issues.

## Layout

Two kinds of trees live here. Neither involves any judgement inside this repo:
which file represents which entity is decided upstream (richlabel) and exported
as-is.

**Representative set** (the CDN contract — what consumers reference):

- `sport-icons/<sport>.svg|webp` — one icon per sport.
- `league-logos/<sport>/<league-slug>.svg|webp` — one logo per league.
- `team-logos/<sport>/<league-slug>/<club-slug>.svg|webp` — one logo per club.
  Some entries carry an `alternate` variant (e.g. `<club-slug>.sportsdb.webp`).
- `athlete-images/<sport>/<athlete-slug>.svg|webp` — one image per athlete
  (namesakes get an id suffix).

Keys and paths already published stay stable across releases: an entity keeps
its key, and entries the exporter did not regenerate are carried forward.
All raster images are **lossless WebP**; SVG stays SVG.

**Per-source archive** (provenance — everything each source served). The archive
lives in this git repository only; it is not part of the npm package, so it is
not served by the package CDN:

- `archive/<source>/<kind>/<source-id>.<sha256-8>.svg|webp` with `<kind>` one of
  `sport-icons`, `league-logos`, `team-logos`, `athlete-images`.
- `archive/<source>/index.json` — one entry per collected file: source id, kind,
  file, original URL, sha256, fetch time, source league id and the source's own
  label (in the source's language). This answers "where exactly did this file
  come from".
- Append-only: a changed graphic gets a new content-hashed file next to the old
  one. Files kept regardless of whether they ever became representative.

`manifest.json` — the index of the representative set (English labels only):

- `sportIcons`, `leagueLogos`, `teamLogos`, `athleteImages`: key → `file`,
  `source`, `license` (required), optional `label`, `alternate`, and the upstream
  entity ids (`richlabelTeamIds` for team logos, `richlabelIds` elsewhere).
- `archives`: source → path of its `archive/<source>/index.json` (repository
  path; not in the npm package).

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
  "version": "0.6.0",
  "licenseNote": "...",
  "sportIcons": {
    "soccer": {
      "file": "sport-icons/soccer.svg",
      "label": "Soccer",
      "source": "polymarket",
      "license": "reference-only"
    }
  },
  "leagueLogos": {},
  "teamLogos": {
    "baseball/kbo/kia-tigers": {
      "file": "team-logos/baseball/kbo/kia-tigers.webp",
      "source": "naver",
      "license": "reference-only",
      "richlabelTeamIds": [43, 657],
      "alternate": { "file": "team-logos/baseball/kbo/kia-tigers.sportsdb.webp", "source": "thesportsdb", "license": "reference-only" }
    }
  },
  "athleteImages": {},
  "archives": {
    "polymarket": "archive/polymarket/index.json"
  }
}
```

`npm run check` (`scripts/check-manifest.mjs`) verifies manifest entries against
the representative-set files and each archive index against the archive files.

## Flags are not here

Flags reference existing public packages directly (no repackaging needed):

```text
Rectangular: https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.5.0/flags/4x3/{cc}.svg
Circular:    https://cdn.jsdelivr.net/gh/hatscripts/circle-flags@2.8.0/flags/{cc}.svg
```

`{cc}` = ISO 3166-1 alpha-2, lowercase. Consuming services follow richlabel's `flags.ts` helper conventions.

## Updating assets

Content is produced upstream by richlabel: its source connectors append to
`archive/<source>/`, and its export command rewrites the representative set and
`manifest.json` in a checkout of this repo. Review the diff, run `npm run check`,
commit, then release as below.

## Releases (GHA only — no local publish)

Pushes/tags are handled by GitHub Actions. Do not run `npm publish` locally.

- PR / push to main → `ci` workflow runs `npm run check` (manifest consistency)
- push a `v*` tag → `publish` workflow runs `npm publish` via npm trusted publishing (OIDC)
- To republish the current main without a tag, manually dispatch `publish` from the Actions tab

## License

Package code/manifest is MIT. Copyright and trademark rights of individual assets follow the
`source`/`license` of each `manifest.json` entry — assets with unclear redistribution rights are marked `"license": "reference-only"`.

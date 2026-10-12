// Imports the richlabel team logo pilot (assets/team-logos/pilot) into this package:
//   1. archive/<source>/team-logos/... — every collected file, kept per source
//      (append-only provenance tree; admins trace any asset back to its source here).
//      Archive is never wiped; re-imports overwrite the same paths.
//   2. team-logos/ — the representative set (wiped + regenerated each run).
//   3. manifest.json — teamLogos regenerated; sportIcons/leagueLogos/archive
//      sections of the existing manifest are preserved/merged, not reset.
//
// All raster assets are stored as lossless WebP (org rule: image assets in this
// package are WebP; SVG stays SVG) — pilot PNGs are converted on import via sharp
// (npm prebuilt binaries; no system ImageMagick).
//
//   node scripts/build-team-logos.mjs <pilot-dir>
//
// Key convention: `<sport>/<league-slug>/<club-slug>` (e.g. baseball/kbo/kia-tigers).
// Club slugs are derived from the TheSportsDB English team name; naver-only rows are
// attached to their canonical club via NAVER_SLUG_MAP below. Rows sharing a slug are
// merged into one club (naver as the primary file, sportsdb as the alternate).
// ROW_FIXES drops/re-routes only affect the representative set — the archive keeps
// the dropped variants too.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pilotDir = process.argv[2];
if (!pilotDir || !existsSync(join(pilotDir, "manifest.json"))) {
  console.error("usage: node scripts/build-team-logos.mjs <pilot-dir (directory containing manifest.json)>");
  process.exit(1);
}

const LEAGUES = {
  4: { sport: "baseball", slug: "kbo", sportsdbLeague: "Korean KBO League" },
  5: { sport: "soccer", slug: "k-league-1", sportsdbLeague: "South Korean K League 1" },
  7: { sport: "soccer", slug: "k-league-2", sportsdbLeague: "South Korean K League 2" },
};

// Pilot source name → canonical Source name (archive dir, manifest source field).
const SOURCE_DIR = { naver: "naver", sportsdb: "thesportsdb" };

// Canonical club slugs for naver-only rows (no sportsdb English name to derive from).
const NAVER_SLUG_MAP = {
  "kbo/HT": "kia-tigers",
  "kbo/KT": "kt-wiz",
  "kbo/LG": "lg-twins",
  "kbo/NC": "nc-dinos",
  "kbo/SK": "ssg-landers",
  "kbo/OB": "doosan-bears",
  "kbo/LT": "lotte-giants",
  "kbo/SS": "samsung-lions",
  "kbo/WO": "kiwoom-heroes",
  "kbo/HH": "hanwha-eagles",
  "kleague/10": "daejeon-hana-citizen",
  "kleague/27": "fc-anyang",
  "kleague2/42": "yongin-fc",
};

// Fixes for known mismatches in the pilot manifest (per-source slug routing).
// team 107 (Seoul, K League 1): naver kleague/09 is FC Seoul, but sportsdb attached the
//   badge of a different K2 club, Seoul E-Land. Move the naver file to fc-seoul and drop
//   the mismatched sportsdb badge (the same badge exists correctly on the Seoul E-Land rows).
// team 217 (Suwon, K League 2): the naver kleague2/02 file is the Suwon Samsung Bluewings
//   emblem, but sportsdb matched Suwon FC. Route each source to its own club.
const ROW_FIXES = {
  107: { variantSlugs: { naver: "fc-seoul" }, dropSources: ["sportsdb"] },
  217: { variantSlugs: { naver: "suwon-samsung-bluewings", sportsdb: "suwon-fc" } },
};

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const pilot = JSON.parse(readFileSync(join(pilotDir, "manifest.json"), "utf8"));
const existingManifest = existsSync(join(root, "manifest.json"))
  ? JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"))
  : {};

/** @type {Map<string, {teamIds: number[], variants: Map<string, {src: string, bytes: number}>}>} */
const clubs = new Map();
/** @type {Map<string, {src: string, bytes: number}>} archive rel-path → source file */
const archiveFiles = new Map();
const skipped = [];

for (const row of pilot.results) {
  const league = LEAGUES[row.league_id];
  if (!league) throw new Error(`unknown league_id ${row.league_id} (team ${row.team_id})`);
  const variants = new Map();
  for (const source of ["naver", "sportsdb"]) {
    if (row[source]?.file) variants.set(source, { src: join(pilotDir, row[source].file), bytes: row[source].bytes });
  }
  if (variants.size === 0) {
    skipped.push(`${row.team_id} ${row.normalized_name} (no logo)`);
    continue;
  }
  if (row.sportsdb && row.sportsdb.league !== league.sportsdbLeague) {
    console.warn(
      `warn: team ${row.team_id} (${row.normalized_name}) sportsdb league "${row.sportsdb.league}" != expected "${league.sportsdbLeague}" — check ROW_FIXES`,
    );
  }
  const fix = ROW_FIXES[row.team_id] ?? {};
  const baseSlug = row.sportsdb?.team ? slugify(row.sportsdb.team) : NAVER_SLUG_MAP[row.naver?.source_id];
  if (!baseSlug) throw new Error(`no slug for team ${row.team_id} (${row.normalized_name}) — add to NAVER_SLUG_MAP`);

  // archive: keep every collected variant per source, including ones ROW_FIXES
  // drops from the representative set below.
  for (const [source, v] of variants) {
    const slug = fix.variantSlugs?.[source] ?? baseSlug;
    const rel = `archive/${SOURCE_DIR[source]}/team-logos/${league.sport}/${league.slug}/${slug}.webp`;
    const prev = archiveFiles.get(rel);
    if (prev && prev.bytes !== v.bytes) {
      console.warn(`warn: archive ${rel} differs between rows (${prev.bytes} vs ${v.bytes} bytes) — keeping first`);
    } else if (!prev) {
      archiveFiles.set(rel, v);
    }
  }

  for (const dropped of fix.dropSources ?? []) variants.delete(dropped);
  if (variants.size === 0) {
    skipped.push(`${row.team_id} ${row.normalized_name} (all variants dropped by ROW_FIXES)`);
    continue;
  }
  for (const [source, v] of variants) {
    const key = `${league.sport}/${league.slug}/${fix.variantSlugs?.[source] ?? baseSlug}`;
    const club = clubs.get(key) ?? { teamIds: [], variants: new Map() };
    if (!club.teamIds.includes(row.team_id)) club.teamIds.push(row.team_id);
    const prev = club.variants.get(source);
    if (prev && prev.bytes !== v.bytes) {
      console.warn(`warn: ${key} ${source} variant differs between rows (${prev.bytes} vs ${v.bytes} bytes) — keeping first`);
    } else if (!prev) {
      club.variants.set(source, v);
    }
    clubs.set(key, club);
  }
}

// 1. archive: append-only per-source tree (overwrite same paths, never wipe)
for (const [rel, v] of [...archiveFiles.entries()].sort()) {
  const dest = join(root, rel);
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(v.src).webp({ lossless: true }).toFile(dest);
}

// 2. regenerate the representative set
rmSync(join(root, "team-logos"), { recursive: true, force: true });
const teamLogos = {};
let fileCount = 0;
for (const [key, club] of [...clubs.entries()].sort()) {
  const primary = club.variants.has("naver") ? "naver" : "sportsdb";
  const entry = {
    file: `team-logos/${key}.webp`,
    source: primary === "naver" ? "naver" : "thesportsdb",
    license: "reference-only",
    richlabelTeamIds: club.teamIds.sort((a, b) => a - b),
  };
  for (const [source, v] of club.variants) {
    const rel = source === primary ? entry.file : `team-logos/${key}.${source}.webp`;
    const dest = join(root, rel);
    mkdirSync(dirname(dest), { recursive: true });
    await sharp(v.src).webp({ lossless: true }).toFile(dest);
    fileCount += 1;
    if (source !== primary) {
      entry.alternate = { file: rel, source: "thesportsdb", license: "reference-only" };
    }
  }
  teamLogos[key] = entry;
}

// 3. manifest: teamLogos regenerated, other sections preserved/merged
const archive = { ...(existingManifest.archive ?? {}) };
for (const rel of archiveFiles.keys()) {
  const m = rel.match(/^archive\/([^/]+)\/(.+)\.webp$/);
  archive[`${m[1]}/${m[2]}`] = { file: rel, source: m[1], license: "reference-only" };
}
const manifest = {
  version: JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version,
  licenseNote: pilot.license_note ?? existingManifest.licenseNote,
  sportIcons: existingManifest.sportIcons ?? {},
  teamLogos,
  leagueLogos: existingManifest.leagueLogos ?? {},
  archive,
};
writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`clubs: ${clubs.size}, representative files: ${fileCount}, archive files: ${archiveFiles.size}`);
if (skipped.length) console.log(`skipped: ${skipped.join("; ")}`);

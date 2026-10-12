// manifest.json <-> disk consistency check.
// - every manifest entry's file exists in the repo and has source/license set
// - every file under sport-icons/, league-logos/, team-logos/, athlete-images/
//   is registered in the manifest
// - every archive/<source>/index.json is listed in manifest.archives, belongs
//   to its source, and lists files that exist; every file under archive/ is
//   either an index or listed in its source's index
// Exit code 0 = consistent, 1 = mismatch.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const SECTIONS = ["sportIcons", "leagueLogos", "teamLogos", "athleteImages"];
const DIRS = ["sport-icons", "league-logos", "team-logos", "athlete-images"];

const errors = [];
const referenced = new Set();
let entryCount = 0;

if (manifest.version !== pkg.version) {
  errors.push(`manifest.version ${manifest.version} != package.json version ${pkg.version}`);
}

const safePath = (file) => !file.startsWith("/") && !file.split("/").includes("..");

const checkEntry = (section, key, entry) => {
  entryCount += 1;
  for (const field of ["file", "source", "license"]) {
    if (!entry[field]) errors.push(`${section}.${key}: missing ${field}`);
  }
  const file = entry.file;
  if (file) {
    if (!safePath(file)) {
      errors.push(`${section}.${key}: unsafe path ${file}`);
    } else {
      referenced.add(file);
      if (!existsSync(join(root, file))) errors.push(`${section}.${key}: file not found: ${file}`);
    }
  }
  if (entry.alternate) checkEntry(`${section}.${key}.alternate`, key, entry.alternate);
};

for (const section of SECTIONS) {
  for (const [key, entry] of Object.entries(manifest[section] ?? {})) checkEntry(section, key, entry);
}

const walk = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
};
const rel = (abs) => abs.slice(root.length + 1);

for (const dir of DIRS) {
  for (const abs of walk(join(root, dir))) {
    if (!referenced.has(rel(abs))) errors.push(`unreferenced file: ${rel(abs)}`);
  }
}

// Per-source archive: archive/<source>/index.json is the provenance record.
const archives = manifest.archives ?? {};
const archived = new Set();
let indexCount = 0;
let archiveEntryCount = 0;
const archiveRoot = join(root, "archive");
const sources = existsSync(archiveRoot) ? readdirSync(archiveRoot).filter((n) => statSync(join(archiveRoot, n)).isDirectory()) : [];
for (const source of sources) {
  const indexPath = `archive/${source}/index.json`;
  if (archives[source] !== indexPath) errors.push(`manifest.archives.${source}: expected ${indexPath}`);
  if (!existsSync(join(root, indexPath))) {
    errors.push(`${indexPath}: missing`);
    continue;
  }
  const index = JSON.parse(readFileSync(join(root, indexPath), "utf8"));
  indexCount += 1;
  archived.add(indexPath);
  if (index.source !== source) errors.push(`${indexPath}: source ${index.source} != ${source}`);
  for (const entry of index.entries ?? []) {
    archiveEntryCount += 1;
    if (!entry.file || !safePath(entry.file) || !entry.file.startsWith(`archive/${source}/`)) {
      errors.push(`${indexPath}: bad file ${entry.file}`);
    } else if (!existsSync(join(root, entry.file))) {
      errors.push(`${indexPath}: file not found: ${entry.file}`);
    } else {
      archived.add(entry.file);
    }
  }
}
for (const [source, indexPath] of Object.entries(archives)) {
  if (!sources.includes(source)) errors.push(`manifest.archives.${source}: ${indexPath} not found`);
}
for (const abs of walk(archiveRoot)) {
  if (!archived.has(rel(abs))) errors.push(`archive file not in its index: ${rel(abs)}`);
}

if (errors.length) {
  console.error(errors.map((e) => `FAIL ${e}`).join("\n"));
  process.exit(1);
}
console.log(
  `ok: ${entryCount} manifest entries, ${referenced.size} referenced files; ` +
    `${indexCount} archive indexes, ${archiveEntryCount} archive entries`,
);

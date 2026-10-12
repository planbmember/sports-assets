// manifest.json <-> disk consistency check.
// - every manifest entry's file exists in the repo and has source/license set
// - every file under team-logos/, sport-icons/, league-logos/ is registered in the manifest
// Exit code 0 = consistent, 1 = mismatch.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const errors = [];
const referenced = new Set();
let entryCount = 0;

if (manifest.version !== pkg.version) {
  errors.push(`manifest.version ${manifest.version} != package.json version ${pkg.version}`);
}

const checkEntry = (section, key, entry) => {
  entryCount += 1;
  for (const field of ["file", "source", "license"]) {
    if (!entry[field]) errors.push(`${section}.${key}: missing ${field}`);
  }
  const file = entry.file;
  if (file) {
    if (file.startsWith("/") || file.includes("..")) {
      errors.push(`${section}.${key}: unsafe path ${file}`);
    } else {
      referenced.add(file);
      if (!existsSync(join(root, file))) errors.push(`${section}.${key}: file not found: ${file}`);
    }
  }
  if (entry.alternate) checkEntry(`${section}.${key}.alternate`, key, entry.alternate);
};

for (const section of ["sportIcons", "teamLogos", "leagueLogos", "archive"]) {
  for (const [key, entry] of Object.entries(manifest[section] ?? {})) checkEntry(section, key, entry);
}

const walk = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
};

for (const dir of ["sport-icons", "team-logos", "league-logos", "archive"]) {
  for (const abs of walk(join(root, dir))) {
    const rel = abs.slice(root.length + 1);
    if (!referenced.has(rel)) errors.push(`unreferenced file: ${rel}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `FAIL ${e}`).join("\n"));
  process.exit(1);
}
console.log(`ok: ${entryCount} manifest entries, ${referenced.size} referenced files, all present and referenced`);

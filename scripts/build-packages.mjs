// Assemble the npm packages listed in packages.json (written upstream by the
// richlabel export — this repo makes no placement decisions).
//
//   node scripts/build-packages.mjs plan  [--version X]   decide what to publish
//   node scripts/build-packages.mjs stage                 copy files into build/
//
// plan: a package is published when its contentHash differs from the one on
// the registry (`npm view <name> contentHash`); shards get the next patch
// version (0.1.0 when new). The core package ("sports-assets") is published on
// every release with the tag version and carries `packages` (name -> version)
// in its manifest.json. Writes build/plan.json and build/lfs-files.txt (the
// files to fetch from Git LFS before `stage`).
//
// stage: copies each planned package's files into build/<name>/, writes its
// package.json, and gives every archive package the fragment of
// archive/<source>/index.json that covers its own files. Fails when a staged
// package or file breaks the size limits.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const build = join(root, "build");
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), "utf8"));
const CORE = "sports-assets";
const [mode, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };

const ledger = readJson("packages.json");
const corePkg = readJson("package.json");

function published(name) {
  const res = spawnSync("npm", ["view", name, "version", "contentHash", "--json"], { encoding: "utf8" });
  if (res.status !== 0) return null; // E404: never published
  const out = JSON.parse(res.stdout || "{}");
  return { version: out.version ?? null, contentHash: out.contentHash ?? null };
}
const nextPatch = (v) => { const [a, b, c] = v.split(".").map(Number); return `${a}.${b}.${c + 1}`; };

if (mode === "plan") {
  const coreVersion = flag("--version") ?? corePkg.version;
  const plan = { core: { name: CORE, version: coreVersion }, packages: {}, publish: [] };
  for (const [name, pkg] of Object.entries(ledger.packages)) {
    if (name === CORE) continue;
    const current = published(name);
    if (current && current.contentHash === pkg.contentHash) {
      plan.packages[name] = current.version;
      continue;
    }
    const version = current?.version ? nextPatch(current.version) : "0.1.0";
    plan.packages[name] = version;
    plan.publish.push(name);
  }
  plan.publish.push(CORE); // core last: its manifest pins the versions above
  rmSync(build, { recursive: true, force: true });
  mkdirSync(build, { recursive: true });
  writeFileSync(join(build, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`);
  const files = plan.publish.flatMap((name) => ledger.packages[name].files);
  writeFileSync(join(build, "lfs-files.txt"), `${files.join("\n")}\n`);
  console.log(`publish ${plan.publish.length}: ${plan.publish.join(", ")}`);
} else if (mode === "stage") {
  const plan = JSON.parse(readFileSync(join(build, "plan.json"), "utf8"));
  const errors = [];
  for (const name of plan.publish) {
    const pkg = ledger.packages[name];
    const dir = join(build, name);
    const version = name === CORE ? plan.core.version : plan.packages[name];
    let bytes = 0;
    for (const file of pkg.files) {
      const size = statSync(join(root, file)).size;
      if (size >= ledger.fileLimitBytes) errors.push(`${name}: ${file} is ${size} bytes`);
      bytes += size;
      mkdirSync(dirname(join(dir, file)), { recursive: true });
      copyFileSync(join(root, file), join(dir, file));
    }
    if (name === CORE) {
      const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
      manifest.version = version;
      manifest.packages = plan.packages;
      writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
      const { scripts, devDependencies, files, ...meta } = corePkg;
      writeFileSync(join(dir, "package.json"), `${JSON.stringify({ ...meta, version, contentHash: pkg.contentHash }, null, 2)}\n`);
      copyFileSync(join(root, "README.md"), join(dir, "README.md"));
    } else {
      const source = pkg.unit.source;
      const index = readJson(`archive/${source}/index.json`);
      const own = new Set(pkg.files);
      const fragment = { ...index, entries: index.entries.filter((e) => own.has(e.file)) };
      writeFileSync(join(dir, "archive", source, "index.json"), `${JSON.stringify(fragment, null, 1)}\n`);
      writeFileSync(join(dir, "package.json"), `${JSON.stringify({
        name, version,
        description: `Sports asset archive data chunk (${source})`,
        license: corePkg.license,
        repository: corePkg.repository,
        publishConfig: corePkg.publishConfig,
        contentHash: pkg.contentHash,
      }, null, 2)}\n`);
    }
    if (bytes > ledger.hardLimitBytes) errors.push(`${name}: ${bytes} bytes > ${ledger.hardLimitBytes}`);
    console.log(`staged ${name}@${version}: ${pkg.files.length} files, ${(bytes / 1048576).toFixed(1)} MB`);
  }
  if (errors.length) {
    console.error(errors.map((e) => `FAIL ${e}`).join("\n"));
    process.exit(1);
  }
} else {
  console.error("usage: build-packages.mjs plan [--version X] | stage");
  process.exit(2);
}

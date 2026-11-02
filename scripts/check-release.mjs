/** Local heuristic release inventory and known-credential scan. No network. */
import {lstatSync, readdirSync, readFileSync} from "node:fs";
import {join, relative, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const EXPECTED = new Set([
  ".gitignore", ".github/workflows/ci.yml", "package.json", "package-lock.json", "tsconfig.json",
  "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md",
  "cli.mjs", "src/model.ts", "src/audit.ts", "src/format.ts", "docs/architecture.md",
  "examples/incomplete.json", "examples/complete.json", "examples/large-offsets.json",
  "scripts/check-release.mjs", "tests/audit.test.mjs", "tests/model.test.mjs", "tests/cli.test.mjs", "tests/release.test.mjs",
]);
const IGNORED = new Set([".git", "node_modules", "out", "coverage"]);
const PATTERNS = [
  ["GitHub credential", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ["cloud access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["private key", /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
  ["service credential", /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/],
  ["credential URL", /https?:\/\/[^\s/@]+:[^\s/@]+@/],
  ["personal filesystem path", /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
  ["assigned credential", /(?:api[_-]?key|password|secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_+/.=-]{12,}["']/i],
];

export function inspectText(text) {
  return PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([label]) => label);
}

export function checkRelease() {
  const found = new Set(), issues = [];
  function walk(directory) {
    for (const entry of readdirSync(directory).sort()) {
      if (IGNORED.has(entry) || entry === ".DS_Store") continue;
      const path = join(directory, entry), name = relative(ROOT, path).replaceAll("\\", "/");
      const info = lstatSync(path);
      if (info.isSymbolicLink()) { issues.push(`${name}: symlink`); continue; }
      if (info.isDirectory()) { walk(path); continue; }
      found.add(name);
      if (!EXPECTED.has(name)) { issues.push(`${name}: outside release inventory`); continue; }
      if (!info.isFile() || info.size > 2_097_152) { issues.push(`${name}: unexpected type/size`); continue; }
      let source;
      try { source = new TextDecoder("utf-8", {fatal: true}).decode(readFileSync(path)); }
      catch { issues.push(`${name}: non-text content`); continue; }
      if (source.includes("\0")) issues.push(`${name}: binary content`);
      for (const label of inspectText(source)) issues.push(`${name}: ${label}`);
      if (name === "cli.mjs" || name.startsWith("src/")) {
        for (const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
          const module = match[1];
          if (!(module.startsWith("./") || module.startsWith("node:")) ||
              /^node:(?:https?|net|tls|dgram|dns|child_process|worker_threads)$/.test(module)) {
            issues.push(`${name}: import requires review: ${module}`);
          }
        }
      }
    }
  }
  walk(ROOT);
  for (const name of EXPECTED) if (!found.has(name)) issues.push(`${name}: missing file`);
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  for (const field of ["dependencies", "optionalDependencies"]) {
    if (Object.keys(pkg[field] ?? {}).length) issues.push(`package.json: unexpected ${field}`);
  }
  if (JSON.stringify(pkg.devDependencies) !== JSON.stringify({typescript: "6.0.3"})) {
    issues.push("package.json: development dependencies differ from the reviewed compiler");
  }
  const lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
  if (Object.keys(lock.packages ?? {}).sort().join(",") !== ",node_modules/typescript" ||
      lock.packages?.["node_modules/typescript"]?.version !== pkg.devDependencies?.typescript) {
    issues.push("package-lock.json: unexpected package inventory or compiler version");
  }
  if (issues.length) {
    console.error("Release check failed; values redacted:\n" + issues.join("\n"));
    return 1;
  }
  console.log(`PASS: ${found.size} inventoried text files; no matching credential or personal-path patterns.`);
  console.log("PASS: no npm runtime dependencies; only the pinned TypeScript development compiler is allowed.");
  console.log("PASS: inspected runtime imports are local or Node built-ins without network/process imports.");
  console.log("Heuristic check only. Review provenance and exact staged contents separately.");
  return 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) process.exitCode = checkRelease();

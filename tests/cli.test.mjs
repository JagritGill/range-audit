import assert from "node:assert/strict";
import test from "node:test";
import {spawn, spawnSync} from "node:child_process";
import {mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {audit} from "../src/audit.ts";
import {jsonReport, svgReport} from "../src/format.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const cli = (...args) => spawnSync(process.execPath, ["cli.mjs", ...args], {cwd: ROOT, encoding: "utf8"});
const temporary = action => {
  const directory = mkdtempSync(join(tmpdir(), "range-audit-test-"));
  try { return action(directory); } finally { rmSync(directory, {recursive: true, force: true}); }
};

test("CLI example and exact-coverage exit codes", () => {
  const result = cli("examples/incomplete.json", "--check");
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /Covered: 11 \| Missing: 1 \| Overlap: 1 \| Redundant: 1/);
  assert.equal(cli("examples/complete.json", "--check").status, 0);
});

test("JSON output uses exact strings and is deterministic", () => {
  const args = ["examples/large-offsets.json", "--format", "json"];
  const first = cli(...args), second = cli(...args);
  assert.equal(first.status, 0, first.stderr);
  assert.equal(first.stdout, second.stdout);
  const data = JSON.parse(first.stdout);
  assert.equal(data.totalBytes, "9007199254741001");
  assert.equal(data.missingBytes, "1");
});

test("existing outputs and inputs are never overwritten", () => temporary(directory => {
  const path = join(directory, "input.json");
  const original = readFileSync(join(ROOT, "examples/complete.json"));
  writeFileSync(path, original);
  const result = cli(path, "--output", path);
  assert.equal(result.status, 2);
  assert.deepEqual(readFileSync(path), original);
  assert.deepEqual(readdirSync(directory), ["input.json"]);
}));

test("new output contains a complete report and no temporary files remain", () => temporary(directory => {
  const path = join(directory, "report.json");
  const result = cli("examples/complete.json", "--format", "json", "--output", path);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(readFileSync(path)).exact, true);
  assert.deepEqual(readdirSync(directory), ["report.json"]);
}));

test("invalid input never publishes a partial output", () => temporary(directory => {
  const input = join(directory, "bad.json"), output = join(directory, "report.txt");
  for (const contents of ["{", Buffer.from([0xff]), "\ufeff{}", " ".repeat(2_097_153), '{"name":"bad","totalBytes":3,"ranges":[]}']) {
    writeFileSync(input, contents);
    const result = cli(input, "--output", output);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.deepEqual(readdirSync(directory), ["bad.json"]);
  }
}));

test("unknown options, missing values, and missing files fail clearly", () => {
  for (const args of [[], ["missing.json"], ["examples/complete.json", "--wat"],
    ["examples/complete.json", "--output"], ["examples/complete.json", "--check", "--check"],
    ["examples/complete.json", "--format", "csv"]]) {
    const result = cli(...args);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^error:/);
  }
  assert.equal(cli("--help").status, 0);
});

test("native JSON.parse duplicate-property behavior is explicit", () => temporary(directory => {
  const path = join(directory, "duplicate.json");
  writeFileSync(path, '{"name":"a","totalBytes":"10","totalBytes":"0","ranges":[]}');
  const result = cli(path, "--format", "json");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).totalBytes, "0");
}));

test("SVG escapes names and contains no scripts or external assets", () => {
  const result = audit({name: '<script>alert("x")</script> & demo', totalBytes: "2", ranges: []});
  const svg = svgReport(result);
  assert.match(svg, /&lt;script&gt;/);
  assert.doesNotMatch(svg, /<script|\son[a-z]+=|\s(?:href|src)=/i);
  assert.doesNotMatch(svg, /NaN|Infinity/);
  assert.equal(JSON.parse(jsonReport(result)).missingBytes, "2");
});

test("SVG handles empty and huge targets without unsafe numeric coordinates", () => {
  for (const totalBytes of ["0", "9".repeat(30)]) {
    const svg = svgReport(audit({name: "test", totalBytes, ranges: []}));
    assert.doesNotMatch(svg, /NaN|Infinity/);
    assert.match(svg, /<svg /);
  }
  const result = cli("examples/incomplete.json", "--format", "svg");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /depth 2/);
});

test("two competing writers cannot replace each other's output", async () => {
  const directory = mkdtempSync(join(tmpdir(), "range-audit-race-"));
  const path = join(directory, "report.json");
  const run = input => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["cli.mjs", input, "--format", "json", "--output", path], {cwd: ROOT, stdio: "ignore"});
    child.on("error", reject);
    child.on("exit", code => resolve(code));
  });
  try {
    const results = await Promise.all([run("examples/complete.json"), run("examples/incomplete.json")]);
    assert.deepEqual(results.sort(), [0, 2]);
    const output = JSON.parse(readFileSync(path));
    assert.ok([true, false].includes(output.exact));
    assert.equal(output.totalBytes, "12");
    assert.deepEqual(readdirSync(directory), ["report.json"]);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

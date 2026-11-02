import {openSync, readSync, closeSync, writeFileSync, mkdtempSync, linkSync, rmSync} from "node:fs";
import {dirname, join} from "node:path";
import {TextDecoder} from "node:util";
import {audit} from "./src/audit.ts";
import {jsonReport, textReport, svgReport} from "./src/format.ts";

const MAX_INPUT_BYTES = 2_097_152;
const HELP = `Usage: node cli.mjs MANIFEST.json [--format text|json|svg] [--output FILE] [--check]

Audit half-open byte ranges offline. --check exits 1 for gaps or overlaps.
--output creates a new file and never overwrites. Offsets must be decimal strings.
`;

function options(argv) {
  if (argv.length === 1 && (argv[0] === "--help" || argv[0] === "-h")) return null;
  if (argv.length === 0 || argv[0].startsWith("--")) throw new Error("provide a manifest path; use --help for usage");
  const result = {input: argv[0], format: "text", output: undefined, check: false};
  const seen = new Set();
  for (let index = 1; index < argv.length; index++) {
    const flag = argv[index];
    if (seen.has(flag)) throw new Error("options must not be repeated");
    seen.add(flag);
    if (flag === "--check") result.check = true;
    else if (flag === "--format" || flag === "--output") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
      if (flag === "--format") result.format = value;
      else result.output = value;
    } else throw new Error("unknown option; use --help for usage");
  }
  if (!["text", "json", "svg"].includes(result.format)) throw new Error("format must be text, json, or svg");
  return result;
}

function readManifest(path) {
  const buffer = Buffer.alloc(MAX_INPUT_BYTES + 1);
  const handle = openSync(path, "r");
  let length = 0;
  try {
    while (length < buffer.length) {
      const bytes = readSync(handle, buffer, length, buffer.length - length, null);
      if (bytes === 0) break;
      length += bytes;
    }
  } finally { closeSync(handle); }
  if (length > MAX_INPUT_BYTES) throw new Error(`manifest exceeds ${MAX_INPUT_BYTES} bytes`);
  let text;
  try { text = new TextDecoder("utf-8", {fatal: true, ignoreBOM: true}).decode(buffer.subarray(0, length)); }
  catch { throw new Error("manifest must be valid UTF-8"); }
  try { return JSON.parse(text); }
  catch { throw new Error("manifest must be valid JSON without a byte-order mark"); }
}

function publish(path, contents) {
  const directory = mkdtempSync(join(dirname(path), ".range-audit-"));
  try {
    const temporary = join(directory, "report");
    writeFileSync(temporary, contents, {encoding: "utf8", flag: "wx", mode: 0o600});
    linkSync(temporary, path);
  } finally { rmSync(directory, {recursive: true, force: true}); }
}

try {
  const args = options(process.argv.slice(2));
  if (args === null) process.stdout.write(HELP);
  else {
    const result = audit(readManifest(args.input));
    const output = args.format === "json" ? jsonReport(result) : args.format === "svg" ? svgReport(result) : textReport(result);
    if (args.output) {
      publish(args.output, output);
      process.stderr.write(`Wrote ${args.output}\n`);
    } else process.stdout.write(output);
    process.exitCode = args.check && !result.exact ? 1 : 0;
  }
} catch (error) {
  process.stderr.write(`error: ${error instanceof Error ? error.message : "unexpected failure"}\n`);
  process.exitCode = 2;
}

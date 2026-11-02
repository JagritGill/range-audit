# Range Audit

**Find gaps and overlaps in chunk-upload manifests, with exact byte offsets.**

Range Audit is a small offline TypeScript tool that checks whether declared
half-open intervals cover a target exactly once. It produces text, JSON, and
self-contained SVG reports. Use it to debug resumable-upload bookkeeping,
partition manifests, or byte-range test fixtures before moving real data.

It audits metadata only. It does not upload, read, hash, or verify the bytes
described by a manifest, and it never connects to a service.

## Quickstart

Use **Node.js 24.4+**. From this folder, without installing packages:

```sh
node cli.mjs examples/incomplete.json
node cli.mjs examples/large-offsets.json --format json
node cli.mjs examples/complete.json --check
node --test tests/*.test.mjs
node scripts/check-release.mjs
```

The first command prints:

```text
A chunk upload with a gap and overlap
Total: 12 bytes | Ranges: 4 | Submitted: 12 bytes
Covered: 11 | Missing: 1 | Overlap: 1 | Redundant: 1
Maximum depth: 2 | Complete: false | Exact: false

Coverage segments [start, end):
  [0, 6) depth=1 covered
  [6, 7) depth=2 OVERLAP
  [7, 9) depth=1 covered
  [9, 10) depth=0 MISSING
  [10, 12) depth=1 covered

This audits declared ranges only; it does not read or verify uploaded bytes.
```

The large-offset example retains a one-byte gap at `9007199254740992`, beyond
JavaScript's safe integer range. All byte offsets and counts use `BigInt`
internally and decimal strings in JSON output. No floating-point arithmetic is
used for the audit.

## Save a report or check in CI

```sh
mkdir -p out
node cli.mjs examples/incomplete.json --format svg --output out/coverage.svg
node cli.mjs examples/incomplete.json --format json --output out/coverage.json

# Intentionally exits 1: this manifest has both a gap and overlap.
node cli.mjs examples/incomplete.json --check
```

Open the SVG in a modern browser or image viewer. It includes a color legend,
exact summary counts, accessible text, and per-segment titles. Tiny intervals
may disappear at the visual scale; use text or JSON to inspect exact boundaries.
Some SVG viewers may not support the wrapped title's `foreignObject` element.

Exit codes: **0** successful analysis, or exact coverage with `--check`; **1**
gaps/overlaps found with `--check`; **2** input, argument, or file error. Without
`--output`, reports go to stdout and errors to stderr. Output files must be new.
The CLI fully validates input and builds the report before publishing it; it
uses a temporary sibling directory and hard-link creation to avoid overwriting
existing files, including a file created by another writer. Repeated runs need
a new output filename. Input files are never overwritten.

## Manifest format

```json
{
  "name": "Two adjacent chunks",
  "totalBytes": "10",
  "ranges": [
    {"id": "part-a", "start": "0", "end": "4"},
    {"id": "part-b", "start": "4", "end": "10"}
  ]
}
```

Every range is **[start, end)**: start included, end excluded. It must satisfy
`0 <= start < end <= totalBytes`. Touching ranges do not overlap. Input order
does not matter. The target starts at byte zero.

- Byte values must be canonical nonnegative decimal **strings**, at most 30
  digits. Numbers, leading zeros (except `"0"`), signs, fractions, and exponents
  are rejected. This avoids precision loss during JSON parsing.
- There may be at most 10,000 ranges. Each ID is unique and matches
  `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`. Duplicate intervals with different IDs are
  allowed and counted as overlapping copies.
- Zero-sized targets with no ranges are complete and exact. Empty ranges are
  rejected. A nonzero target with no ranges is entirely missing.
- The name contains 1–120 UTF-16 code units without control characters, lone
  surrogates, or the XML-invalid U+FFFE/U+FFFF characters.
- The manifest is UTF-8 JSON, at most 2 MiB, without a byte-order mark. Only the
  documented fields are accepted. As with native `JSON.parse`, duplicate JSON
  property names use their last value; avoid ambiguous manifests. This is
  distinct from duplicate range IDs, which are rejected.

## What the metrics mean

| Metric | Meaning |
| --- | --- |
| Submitted | Sum of every declared range length, including repeated copies |
| Covered | Distinct byte positions covered at least once |
| Missing | Target positions not covered |
| Overlap | Distinct positions covered at least twice |
| Redundant | Extra copies beyond the first at every covered position |
| Maximum depth | Greatest number of ranges covering any position |
| Complete | No missing bytes; overlaps may still exist |
| Exact | Every target byte is covered exactly once |

For three copies of `[0, 5)`, overlap is **5** bytes, redundant is **10**, and
submitted is **15**. The report coalesces adjacent segments with the same depth;
it does not preserve which range IDs own each segment. Useful consistency checks
are `covered + missing = total` and `covered + redundant = submitted`.

## Engineering and honest scope

The pure core uses an event-boundary sweep, so a huge target does not require
iterating over every byte. Tests check 4,096 small interval multisets against an
independent byte-by-byte oracle, plus large offsets, endpoint ties, schema limits,
permutation invariance, output safety, and SVG escaping. See
[architecture and tradeoffs](docs/architecture.md).

Source uses erasable TypeScript syntax and Node's [native type stripping](https://nodejs.org/api/typescript.html).
Runtime validation and automated tests are included. **No static TypeScript type
checker is bundled or run**; Node strips annotations without checking them.
There are no npm runtime or development dependencies, and no build step. The
package is marked private to prevent accidental npm publication; the source
repository remains public.

This is not an upload client, storage verifier, checksum tool, or HTTP Range
header parser. Inputs are synthetic examples or user-supplied metadata; no
performance, adoption, or production-readiness claims are made. Hard-link-based
output requires compatible storage and does not guarantee crash durability.

Created with AI assistance in Codex. Original project files use the [MIT License](LICENSE).
See [dependency attribution and provenance](THIRD_PARTY_NOTICES.md).

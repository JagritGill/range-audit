# Working in Range Audit

Offline byte-range coverage analysis with text, JSON, and standalone SVG reports.
Read [README](README.md) for the manifest/CLI contract and
[architecture](docs/architecture.md) for the event sweep and publication choices.
Retain [MIT](LICENSE), [attribution](THIRD_PARTY_NOTICES.md), and metadata-only scope.

## Map and invariants

| Location | Responsibility |
| --- | --- |
| `src/model.ts` | Validate unknown manifests; convert decimal strings to BigInt |
| `src/audit.ts` | Pure event sweep, depth segments, exact metrics |
| `src/format.ts` | Text/JSON/SVG formatting and escaping |
| `cli.mjs` | Bounded file reads, options, safe publication, exit codes |
| `tests/` | Independent per-byte oracle, validation, formatting, CLI and races |
| `tsconfig.json`, `scripts/check-release.mjs` | Strict core check; release inventory/import/credential checks |

- Ranges are half-open `[start,end)` within `[0,totalBytes)`. Touching endpoints
  do not overlap. Equal-offset events emit no span; apply all their deltas before
  the next span. Coalesce equal-depth neighbors without retaining owner sets.
- Byte offsets/counts use BigInt and canonical decimal strings; never round via
  Number. SVG converts only bounded scaled pixel coordinates to Number.
- Preserve `covered + missing = total` and `covered + redundant = submitted`.
  Overlap counts positions with multiple copies; redundant counts extra copies.
  Complete permits overlap; exact does not. An empty target is vacuously exact.
- Keep strict schema/size limits, unique IDs, Unicode validation, and SVG escaping.
  Native JSON.parse uses the last duplicate property value; do not claim otherwise.
- Core functions remain pure/offline. No upload, content verification, services,
  or hardware. SVG may hide tiny intervals; text/JSON retain exact boundaries.
- Construct the full report before output. File publication uses a temporary
  sibling and no-replace hard link; preserve collision tests and cleanup. This
  needs hard-link-compatible storage and is not a crash-durability guarantee.

## Setup and verified commands

Run from the repository root with Node 24.4+. Runtime and runtime tests need no
package install or build. Use erasable TypeScript compatible with native Node
type stripping; stripping alone does not check types.

```sh
node --version
node cli.mjs examples/incomplete.json
node cli.mjs examples/large-offsets.json --format json
node cli.mjs examples/complete.json --check
node --test tests/*.test.mjs
node scripts/check-release.mjs
git diff --check
```

These commands exit 0. The incomplete example reports one missing and one
overlapping byte. Adding `--check` to it intentionally exits 1. Invalid input or
I/O exits 2. Choose new output paths under ignored `out/`; README shows SVG/JSON.

TypeScript 6.0.3 is the single pinned development dependency. If it is already
available locally or on PATH, run:

```sh
npm run check:types
```

If using an existing approved compiler outside this repo, set `RANGE_AUDIT_TSC`
to that installation's `lib/tsc.js` path, then run:

```sh
node "$RANGE_AUDIT_TSC" --version
node "$RANGE_AUDIT_TSC" --project tsconfig.json --pretty false
```

Verify version 6.0.3. These commands were checked with the Mac's existing compiler.
Do not install packages when the task forbids it; report a missing compiler
instead of silently skipping checks. README documents the lockfile-based setup
for tasks where installation is authorized. Static checking covers `src/**/*.ts`
only; the JavaScript CLI/tests/scanner have runtime verification.

Retain strict compiler options and the independent 4,096-case per-byte oracle.
Reproduce defects and add failing-before-fix regressions for relevant endpoint
ties, huge offsets, empty/duplicate intervals, schema errors, output races, and
escaping. Visually inspect SVG changes, alongside exact JSON assertions. Doc-only
changes need verified commands/links and release scanning, not redundant tests.

## Ownership and handoff

Inspect `git status --short --branch` and `git diff --stat` before editing.
Origin is `JagritGill/range-audit`. Preserve pending changes; do not reset, clean,
or stage unrelated work. In the managed workspace, inspect parent `PROJECTS.md`
and `BUILD_STATUS.md` if present; coordinate with the current owner and avoid
overlapping daily builds. Use Jagrit's connected Mac; report disconnection.

Use this original repo and synthetic fixtures only. No private/employer source,
secrets, personal paths, or external-reviewer disclosures. Do not use CodeRabbit
or send it code; use local review/tests and existing CI. Put reports in `out/`.
Register intended new files in the release inventory so they remain scanned;
heuristic scans do not replace provenance review.

Local edits do not authorize commit/push/merge/release, dependency or paid-service
changes, account/security changes, or hardware actions. Follow the current
request's scope; never bypass failing checks. Handoff should give changed files,
exact commands/exits, runtime/compiler versions, limits, and unpublished state.
Separate newly run checks from prior CI; never claim unobserved CI success.

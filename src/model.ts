/** Runtime validation remains necessary: native TypeScript stripping does not type-check. */

export interface Range {
  readonly id: string;
  readonly start: bigint;
  readonly end: bigint;
}

export interface Manifest {
  readonly name: string;
  readonly totalBytes: bigint;
  readonly ranges: readonly Range[];
}

export const MAX_RANGES = 10_000;
const DECIMAL = /^(0|[1-9][0-9]{0,29})$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function object(value: unknown, fields: string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = [...fields].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} requires exactly: ${fields.join(", ")}`);
  }
  return record;
}

function offset(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    throw new Error(`${label} must be a canonical nonnegative decimal string of at most 30 digits`);
  }
  return BigInt(value);
}

export function parseManifest(value: unknown): Manifest {
  const input = object(value, ["name", "totalBytes", "ranges"], "manifest");
  if (typeof input.name !== "string" || input.name.length < 1 || input.name.length > 120 ||
      !input.name.isWellFormed() || /[\u0000-\u001f\u007f-\u009f\ufffe\uffff]/u.test(input.name)) {
    throw new Error("name must contain 1 to 120 characters without control characters");
  }
  const totalBytes = offset(input.totalBytes, "totalBytes");
  if (!Array.isArray(input.ranges) || input.ranges.length > MAX_RANGES) {
    throw new Error(`ranges must be an array of at most ${MAX_RANGES} entries`);
  }
  const seen = new Set<string>();
  const ranges = input.ranges.map((value, index): Range => {
    const range = object(value, ["id", "start", "end"], `ranges[${index}]`);
    if (typeof range.id !== "string" || !ID.test(range.id) || seen.has(range.id)) {
      throw new Error(`ranges[${index}].id must be a unique 1–64 character ASCII identifier`);
    }
    seen.add(range.id);
    const start = offset(range.start, `ranges[${index}].start`);
    const end = offset(range.end, `ranges[${index}].end`);
    if (start >= end || end > totalBytes) {
      throw new Error(`ranges[${index}] must satisfy 0 <= start < end <= totalBytes`);
    }
    return {id: range.id, start, end};
  });
  return {name: input.name, totalBytes, ranges};
}

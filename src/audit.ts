/** Sweep event boundaries, never individual bytes. Intervals are half-open. */

import {parseManifest} from "./model.ts";

export interface Segment {
  readonly start: bigint;
  readonly end: bigint;
  readonly depth: number;
}

export interface Audit {
  readonly name: string;
  readonly totalBytes: bigint;
  readonly rangeCount: number;
  readonly submittedBytes: bigint;
  readonly coveredBytes: bigint;
  readonly missingBytes: bigint;
  readonly overlapBytes: bigint;
  readonly redundantBytes: bigint;
  readonly maxDepth: number;
  readonly complete: boolean;
  readonly exact: boolean;
  readonly segments: readonly Segment[];
}

export function audit(value: unknown): Audit {
  const manifest = parseManifest(value);
  const events: {at: bigint; delta: number}[] = [
    {at: 0n, delta: 0}, {at: manifest.totalBytes, delta: 0},
  ];
  let submittedBytes = 0n;
  for (const range of manifest.ranges) {
    events.push({at: range.start, delta: 1}, {at: range.end, delta: -1});
    submittedBytes += range.end - range.start;
  }
  events.sort((a, b) => a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  const segments: Segment[] = [];
  let depth = 0;
  let start = 0n;
  for (const event of events) {
    if (event.at > start) {
      const end = event.at;
      const last = segments.at(-1);
      if (last && last.depth === depth && last.end === start) {
        segments[segments.length - 1] = {start: last.start, end, depth};
      } else {
        segments.push({start, end, depth});
      }
      start = end;
    }
    // Equal-offset events emit no span, so all ties apply before the next span.
    depth += event.delta;
  }
  let coveredBytes = 0n;
  let overlapBytes = 0n;
  let redundantBytes = 0n;
  let maxDepth = 0;
  for (const segment of segments) {
    const length = segment.end - segment.start;
    maxDepth = Math.max(maxDepth, segment.depth);
    if (segment.depth > 0) coveredBytes += length;
    if (segment.depth > 1) {
      overlapBytes += length;
      redundantBytes += length * BigInt(segment.depth - 1);
    }
  }
  const missingBytes = manifest.totalBytes - coveredBytes;
  return {
    name: manifest.name, totalBytes: manifest.totalBytes, rangeCount: manifest.ranges.length,
    submittedBytes, coveredBytes, missingBytes, overlapBytes, redundantBytes, maxDepth,
    complete: missingBytes === 0n, exact: missingBytes === 0n && overlapBytes === 0n, segments,
  };
}

import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {audit} from "../src/audit.ts";

const manifest = (total, ranges) => ({name: "test", totalBytes: String(total),
  ranges: ranges.map(([start, end], index) => ({id: `r${index}`, start: String(start), end: String(end)}))});

test("synthetic example distinguishes gaps and overlap", () => {
  const result = audit(JSON.parse(readFileSync(new URL("../examples/incomplete.json", import.meta.url))));
  assert.equal(result.coveredBytes, 11n);
  assert.equal(result.missingBytes, 1n);
  assert.equal(result.overlapBytes, 1n);
  assert.equal(result.redundantBytes, 1n);
  assert.deepEqual(result.segments, [
    {start: 0n, end: 6n, depth: 1}, {start: 6n, end: 7n, depth: 2},
    {start: 7n, end: 9n, depth: 1}, {start: 9n, end: 10n, depth: 0}, {start: 10n, end: 12n, depth: 1},
  ]);
});

test("touching ranges are not overlapping and coalesce", () => {
  const result = audit(manifest(12, [[8, 12], [0, 4], [4, 8]]));
  assert.equal(result.exact, true);
  assert.deepEqual(result.segments, [{start: 0n, end: 12n, depth: 1}]);
});

test("empty targets and empty manifests have defined coverage", () => {
  assert.equal(audit(manifest(0, [])).exact, true);
  assert.deepEqual(audit(manifest(0, [])).segments, []);
  assert.deepEqual(audit(manifest(5, [])).segments, [{start: 0n, end: 5n, depth: 0}]);
});

test("redundant bytes count every extra copy", () => {
  const result = audit(manifest(5, [[0, 5], [0, 5], [0, 5]]));
  assert.equal(result.complete, true);
  assert.equal(result.exact, false);
  assert.equal(result.overlapBytes, 5n);
  assert.equal(result.redundantBytes, 10n);
  assert.equal(result.submittedBytes, 15n);
});

test("one-byte gaps beyond safe Number precision stay exact", () => {
  const result = audit(JSON.parse(readFileSync(new URL("../examples/large-offsets.json", import.meta.url))));
  assert.equal(result.totalBytes, 9007199254741001n);
  assert.equal(result.missingBytes, 1n);
  assert.deepEqual(result.segments[1], {start: 9007199254740992n, end: 9007199254740993n, depth: 0});
});

test("maximum-size offsets require work only at boundaries", () => {
  const maximum = "9".repeat(30);
  const result = audit(manifest(maximum, [["0", maximum]]));
  assert.equal(result.totalBytes, BigInt(maximum));
  assert.equal(result.exact, true);
  assert.equal(result.segments.length, 1);
});

test("input is not mutated", () => {
  const input = manifest(5, [[2, 4], [0, 3]]);
  input.ranges.forEach(Object.freeze);
  Object.freeze(input.ranges);
  Object.freeze(input);
  assert.equal(audit(input).overlapBytes, 1n);
});

test("4,096 small interval multisets match an independent per-byte oracle", () => {
  const possible = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  for (let encoded = 0; encoded < 4096; encoded++) {
    const ranges = [];
    let remaining = encoded;
    for (const range of possible) {
      for (let repeat = 0; repeat < remaining % 4; repeat++) ranges.push(range);
      remaining = Math.floor(remaining / 4);
    }
    const depths = [0, 1, 2].map(byte => ranges.filter(([start, end]) => start <= byte && byte < end).length);
    const result = audit(manifest(3, ranges));
    const message = `multiset ${encoded}`;
    assert.equal(result.coveredBytes, BigInt(depths.filter(depth => depth > 0).length), message);
    assert.equal(result.missingBytes, BigInt(depths.filter(depth => depth === 0).length), message);
    assert.equal(result.overlapBytes, BigInt(depths.filter(depth => depth > 1).length), message);
    assert.equal(result.redundantBytes, BigInt(depths.reduce((sum, depth) => sum + Math.max(0, depth - 1), 0)), message);
    assert.equal(result.maxDepth, Math.max(...depths), message);
    assert.equal(result.submittedBytes, result.coveredBytes + result.redundantBytes, message);
    assert.equal(result.totalBytes, result.coveredBytes + result.missingBytes, message);
    assert.equal(result.complete, depths.every(depth => depth > 0), message);
    assert.equal(result.exact, depths.every(depth => depth === 1), message);
    const expanded = result.segments.flatMap(segment => Array(Number(segment.end - segment.start)).fill(segment.depth));
    assert.deepEqual(expanded, depths, message);
    for (let index = 1; index < result.segments.length; index++) {
      assert.equal(result.segments[index - 1].end, result.segments[index].start, message);
      assert.notEqual(result.segments[index - 1].depth, result.segments[index].depth, message);
    }
    assert.deepEqual(audit(manifest(3, [...ranges].reverse())), result, message);
  }
});

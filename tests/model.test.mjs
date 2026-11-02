import assert from "node:assert/strict";
import test from "node:test";
import {parseManifest, MAX_RANGES} from "../src/model.ts";

const valid = () => ({name: "valid", totalBytes: "10", ranges: [{id: "a", start: "0", end: "10"}]});

test("rejects invalid root shapes and extra fields", () => {
  for (const value of [null, [], 3, {}, {...valid(), extra: true}, {"name\0ranges": [], totalBytes: "0"}]) {
    assert.throws(() => parseManifest(value));
  }
});

test("offsets must be canonical bounded strings", () => {
  for (const totalBytes of [10, 10n, null, true, "", "01", "-0", "-1", "1.0", "1e2", "1\n", "9".repeat(31)]) {
    assert.throws(() => parseManifest({...valid(), totalBytes}));
  }
});

test("names reject controls, lone surrogates, and invalid XML characters", () => {
  for (const name of ["", null, "x".repeat(121), "bad\nname", "bad\u0085name", "\ud800", "\ufffe"]) {
    assert.throws(() => parseManifest({...valid(), name}));
  }
  assert.equal(parseManifest({...valid(), name: "A valid 😀 name"}).name, "A valid 😀 name");
});

test("rejects reversed, empty, and out-of-bounds ranges", () => {
  for (const [start, end] of [["5", "4"], ["5", "5"], ["0", "11"], ["-1", "5"]]) {
    assert.throws(() => parseManifest({...valid(), ranges: [{id: "a", start, end}]}));
  }
});

test("identifiers must be unique and cannot contain markup", () => {
  for (const ranges of [[...valid().ranges, ...valid().ranges], [{id: "bad id", start: "0", end: "1"}],
    [{id: "<script>", start: "0", end: "1"}], [{id: "a", start: "0", end: "1", extra: true}]]) {
    assert.throws(() => parseManifest({...valid(), ranges}));
  }
});

test("range count boundary is enforced", () => {
  const ranges = Array.from({length: MAX_RANGES}, (_, index) => ({id: `r${index}`, start: "0", end: "1"}));
  assert.equal(parseManifest({...valid(), ranges}).ranges.length, MAX_RANGES);
  assert.throws(() => parseManifest({...valid(), ranges: [...ranges, {id: "extra", start: "0", end: "1"}]}));
});

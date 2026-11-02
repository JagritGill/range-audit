import assert from "node:assert/strict";
import test from "node:test";
import {inspectText} from "../scripts/check-release.mjs";

test("release scanner recognizes synthetic credential patterns", () => {
  const samples = ["ghp_" + "A".repeat(36), "AKIA" + "A".repeat(16), "-----BEGIN " + "PRIVATE KEY-----",
    "sk-" + "A".repeat(32), "https://" + "name:secret@example.invalid", "/" + "Users/example/private/",
    "api_key = '" + "A".repeat(20) + "'"];
  for (const sample of samples) assert.ok(inspectText(sample).length > 0);
  assert.deepEqual(inspectText("export function add(a, b) { return a + b; }"), []);
});

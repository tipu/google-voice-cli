import assert from "node:assert/strict";
import test from "node:test";

import { parseDuration } from "../src/duration.js";

test("parseDuration supports practical recent-message windows", () => {
  assert.equal(parseDuration("30m"), 30 * 60 * 1_000);
  assert.equal(parseDuration("24h"), 24 * 60 * 60 * 1_000);
  assert.equal(parseDuration("72H"), 72 * 60 * 60 * 1_000);
  assert.equal(parseDuration("7d"), 7 * 24 * 60 * 60 * 1_000);
});

test("parseDuration rejects ambiguous or excessive values", () => {
  assert.throws(() => parseDuration("yesterday"), /duration must look like/);
  assert.throws(() => parseDuration("0m"), /at least one second/);
  assert.throws(() => parseDuration("366d"), /cannot exceed/);
});

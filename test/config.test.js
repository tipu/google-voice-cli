import assert from "node:assert/strict";
import test from "node:test";

import { cdpEndpoint } from "../src/config.js";

test("cdpEndpoint reads GVOICE_CDP_URL and is null without it", () => {
  assert.equal(cdpEndpoint({ GVOICE_CDP_URL: "http://127.0.0.1:9479" }), "http://127.0.0.1:9479");
  assert.equal(cdpEndpoint({}), null);
});

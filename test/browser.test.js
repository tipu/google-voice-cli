import assert from "node:assert/strict";
import test from "node:test";

import { isReadOnlyVoiceRequest } from "../src/browser.js";

test("read-only guard allows the known thread read endpoints", () => {
  assert.equal(
    isReadOnlyVoiceRequest(
      "https://clients6.google.com/voice/v1/voiceclient/api2thread/list",
    ),
    true,
  );
  assert.equal(
    isReadOnlyVoiceRequest(
      "https://clients6.google.com/voice/v1/voiceclient/api2thread/get",
    ),
    true,
  );
});

test("read-only guard rejects unknown and state-changing Voice endpoints", () => {
  assert.equal(
    isReadOnlyVoiceRequest(
      "https://clients6.google.com/voice/v1/voiceclient/api2thread/markread",
    ),
    false,
  );
  assert.equal(
    isReadOnlyVoiceRequest(
      "https://clients6.google.com/voice/v1/voiceclient/message/send",
    ),
    false,
  );
});

test("read-only guard does not interfere with unrelated requests", () => {
  assert.equal(
    isReadOnlyVoiceRequest("https://voice.google.com/u/0/messages"),
    true,
  );
});

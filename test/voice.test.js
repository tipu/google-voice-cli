import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthenticationRequiredError,
  decodeRecentMessages,
  extractRecentMessages,
  isVoiceAppUrl,
  messagesUrl,
} from "../src/voice.js";

test("messagesUrl points at the signed-in text inbox", () => {
  assert.equal(
    messagesUrl(),
    "https://voice.google.com/u/0/messages",
  );
});

test("isVoiceAppUrl rejects sign-in and marketing destinations", () => {
  assert.equal(isVoiceAppUrl("https://voice.google.com/u/0/messages"), true);
  assert.equal(isVoiceAppUrl("https://voice.google.com/landing"), false);
  assert.equal(
    isVoiceAppUrl("https://accounts.google.com/v3/signin/identifier"),
    false,
  );
  assert.equal(
    isVoiceAppUrl("https://workspace.google.com/products/voice/"),
    false,
  );
});

test("decodeRecentMessages filters by exact timestamp and direction", () => {
  const now = Date.parse("2026-08-28T12:00:00.000Z");
  const message = (timestamp, direction, text) => {
    const value = [];
    value[1] = timestamp;
    value[4] = direction;
    value[9] = text;
    return value;
  };
  const thread = [];
  thread[2] = [
    message(now - 10 * 60_000, 10, "recent incoming"),
    message(now - 20 * 60_000, 11, "recent outgoing"),
    message(now - 40 * 60_000, 10, "too old"),
  ];

  const result = decodeRecentMessages([[thread]], ["Ada"], {
    incomingOnly: true,
    now,
    sinceMs: 30 * 60_000,
  });

  assert.equal(result.count, 1);
  assert.deepEqual(result.messages[0], {
    direction: "incoming",
    participant: "Ada",
    text: "recent incoming",
    thread: 1,
    timestamp: "2026-08-28T11:50:00.000Z",
  });
});

test("extractRecentMessages reports the navigation error when the browser closes", async () => {
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const page = {
      goto: async () => {},
      url: () => "https://voice.google.com/landing",
      waitForLoadState: async () => {},
      waitForResponse: () =>
        new Promise((resolve, reject) =>
          setImmediate(() =>
            reject(new Error("Target page, context or browser has been closed")),
          ),
        ),
    };

    await assert.rejects(
      extractRecentMessages(page, { sinceMs: 60_000 }),
      AuthenticationRequiredError,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

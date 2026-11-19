import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthenticationRequiredError,
  decodeRecentMessages,
  coldSyncTextPageSize,
  coldSyncTextThreads,
  extractRecentMessages,
  firstThreadPageSize,
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

test("firstThreadPageSize matches the first text-thread page at any page size", () => {
  assert.equal(firstThreadPageSize([2, 20, 15, null, null, [null, 1, 1, 1]]), 20);
  assert.equal(firstThreadPageSize([2, 100, 15, null, null, [null, 1, 1, 1]]), 100);
  assert.equal(firstThreadPageSize([2, 20, 15, "1790962205630", null, [null, 1, 1, 1]]), null);
  assert.equal(firstThreadPageSize([1, 20, 15, null, null, [null, 1, 1, 1]]), null);
  assert.equal(firstThreadPageSize(null), null);
});

test("extractRecentMessages reads a 20-thread first page and flags the truncated source", async () => {
  const now = Date.parse("2026-10-06T20:00:00.000Z");
  const threads = Array.from({ length: 20 }, (_, index) => [
    `t${index}`,
    null,
    [[`m${index}`, now - (index + 1) * 60_000, null, null, 10, null, null, null, null, `hello ${index}`]],
  ]);
  const page = {
    evaluate: async () => threads.map((_, index) => `Person ${index}`),
    goto: async () => {},
    url: () => "https://voice.google.com/u/0/messages",
    waitForLoadState: async () => {},
    waitForResponse: async (predicate) => {
      const responses = [
        [1, 20, 15, null, null, [null, 1, 1, 1]],
        [2, 20, 15, null, null, [null, 1, 1, 1]],
      ].map((body) => ({
        json: async () => [threads],
        request: () => ({ postDataJSON: () => body }),
        url: () => "https://clients6.google.com/voice/v1/voiceclient/api2thread/list?alt=protojson",
      }));
      const match = responses.find(predicate);
      assert.deepEqual(match.request().postDataJSON()[0], 2);
      return match;
    },
  };

  const result = await extractRecentMessages(page, { now, sinceMs: 24 * 60 * 60_000 });

  assert.equal(result.count, 20);
  assert.equal(result.messages[0].participant, "Person 0");
  assert.equal(result.sourceTruncated, true);
});

test("coldSyncTextPageSize reads the text folder page size from the cold sync request", () => {
  const folders = [[1, 0, 0], [2, 100, 50], [3, 0, 0]];
  assert.equal(coldSyncTextPageSize([folders, [1, 1, 1, 1, 0]]), 100);
  assert.equal(coldSyncTextPageSize([[[1, 0, 0], [2, 0, 0]], [1, 1, 1, 1, 0]]), null);
  assert.equal(coldSyncTextPageSize([[[1, 20, 15]], [1, 1, 1, 1, 0]]), null);
  assert.equal(coldSyncTextPageSize(null), null);
});

test("coldSyncTextThreads returns only the text folder threads", () => {
  const textThreads = [["t.1", 0, []]];
  assert.deepEqual(coldSyncTextThreads([[[1, ""], [2, "cursor", textThreads], [3, ""]]]), textThreads);
  assert.deepEqual(coldSyncTextThreads([[[1, ""], [3, ""]]]), []);
  assert.deepEqual(coldSyncTextThreads(null), []);
});

test("extractRecentMessages reads the text folder from the cold sync and skips the mixed thread list", async () => {
  const now = Date.parse("2026-11-19T20:00:00.000Z");
  const message = (id, ageMinutes, direction, text) => [id, now - ageMinutes * 60_000, null, null, direction, null, null, null, null, text];
  const textThreads = [
    ["t.a", 0, [message("m1", 1, 10, "hello"), message("m2", 2, 11, "hi")]],
    ["t.b", 0, [message("m3", 3, 10, "later")]],
  ];
  const mixedThreads = [["c.x", 0, [message("m9", 1, 10, "from the mixed folder")]], ...textThreads];
  const page = {
    evaluate: async () => ["Person A", "Person B"],
    goto: async () => {},
    url: () => "https://voice.google.com/u/0/messages",
    waitForLoadState: async () => {},
    waitForResponse: async (predicate) => {
      const responses = [
        {
          json: async () => [mixedThreads],
          request: () => ({ postDataJSON: () => [1, 20, 15, null, null, [null, 1, 1, 1]] }),
          url: () => "https://clients6.google.com/voice/v1/voiceclient/api2thread/list?alt=protojson",
        },
        {
          json: async () => [[[1, ""], [2, "cursor", textThreads], [3, ""]]],
          request: () => ({ postDataJSON: () => [[[1, 0, 0], [2, 100, 50], [3, 0, 0]], [1, 1, 1, 1, 0]] }),
          url: () => "https://clients6.google.com/voice/v1/voiceclient/inbox/coldsync?alt=protojson",
        },
      ];
      return responses.find(predicate);
    },
  };

  const result = await extractRecentMessages(page, { now, sinceMs: 24 * 60 * 60_000 });

  assert.equal(result.count, 3);
  assert.deepEqual(
    result.messages.map(({ direction, participant, text }) => [direction, participant, text]),
    [
      ["incoming", "Person A", "hello"],
      ["outgoing", "Person A", "hi"],
      ["incoming", "Person B", "later"],
    ],
  );
  assert.equal(result.sourceTruncated, false);
});

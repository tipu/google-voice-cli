import { VOICE_URL } from "./config.js";

const MESSAGES_PATH = "messages";
const MESSAGE_THREAD_SELECTOR = "gv-message-thread-list-item";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Google Voice is not signed in. Run `gvoice login` first.");
    this.name = "AuthenticationRequiredError";
  }
}

export function messagesUrl() {
  return `${VOICE_URL}/${MESSAGES_PATH}`;
}

export function isVoiceAppUrl(rawUrl) {
  const url = new URL(rawUrl);
  return (
    url.hostname === "voice.google.com" &&
    !url.pathname.startsWith("/landing")
  );
}

export async function navigateToMessages(page) {
  await page.goto(messagesUrl(), { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

  if (!isVoiceAppUrl(page.url())) {
    throw new AuthenticationRequiredError();
  }
}

export async function accountStatus(page) {
  await navigateToMessages(page);

  const data = await page.evaluate(() => {
    const visibleText = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none";
    };

    const labels = [...document.querySelectorAll("[aria-label]")]
      .filter(visibleText)
      .map((element) => element.getAttribute("aria-label"))
      .filter(Boolean);

    const accountLabel =
      labels.find((label) => /google account|account:/i.test(label)) || null;

    return {
      accountLabel,
      title: document.title,
    };
  });

  return { authenticated: true, url: page.url(), ...data };
}

export async function extractMessageThreads(page, limit = 20) {
  await navigateToMessages(page);
  await page
    .locator(MESSAGE_THREAD_SELECTOR)
    .first()
    .waitFor({ state: "attached", timeout: 5_000 })
    .catch(() => {});

  return page.evaluate(
    ({ itemSelector, limit }) => {
      const candidates = [...document.querySelectorAll(itemSelector)];

      const seen = new Set();
      const items = [];
      for (const element of candidates) {
        if (!(element instanceof HTMLElement)) continue;
        const text = element.innerText.replace(/\s+/g, " ").trim();
        if (!text || seen.has(text)) continue;

        if (text.length > 2_000) continue;

        seen.add(text);
        items.push({
          unread: !element.querySelector(".container")?.classList.contains("read"),
          text,
        });
        if (items.length >= limit) break;
      }

      return items;
    },
    { itemSelector: MESSAGE_THREAD_SELECTOR, limit },
  );
}

export async function extractRecentMessages(
  page,
  { incomingOnly = false, limit = 100, now = Date.now(), sinceMs },
) {
  const responsePromise = page.waitForResponse(
    (response) => {
      if (!response.url().includes("/voice/v1/voiceclient/api2thread/list")) return false;
      try {
        const request = response.request().postDataJSON();
        return request?.[0] === 2 && request?.[1] === 100;
      } catch {
        return false;
      }
    },
    { timeout: 15_000 },
  );
  await navigateToMessages(page);
  const payload = await (await responsePromise).json();

  const participants = await page.evaluate((itemSelector) => {
    const clean = (value) => value?.replace(/\s+/g, " ").trim() || null;
    return [...document.querySelectorAll(itemSelector)].map((element) =>
      clean(element.querySelector("gv-annotation.participants")?.textContent),
    );
  }, MESSAGE_THREAD_SELECTOR);

  return decodeRecentMessages(payload, participants, {
    incomingOnly,
    limit,
    now,
    sinceMs,
  });
}

export function decodeRecentMessages(
  payload,
  participants,
  { incomingOnly = false, limit = 100, now = Date.now(), sinceMs },
) {
  const cutoffMs = now - sinceMs;
  const rawThreads = Array.isArray(payload?.[0]) ? payload[0] : [];
  const messages = [];
  const latestThreadTimestamps = [];

  rawThreads.forEach((thread, threadIndex) => {
    const rawMessages = Array.isArray(thread?.[2]) ? thread[2] : [];
    const latestTimestamp = rawMessages.find((message) => Number.isFinite(message?.[1]))?.[1];
    if (Number.isFinite(latestTimestamp)) latestThreadTimestamps.push(latestTimestamp);
    rawMessages.forEach((message) => {
      const timestampMs = message?.[1];
      const text =
        typeof message?.[9] === "string"
          ? message[9].replace(/\s+/g, " ").trim()
          : "";
      const direction = message?.[4] === 10 ? "incoming" : message?.[4] === 11 ? "outgoing" : "unknown";

      if (!Number.isFinite(timestampMs) || timestampMs < cutoffMs || !text) return;
      if (incomingOnly && direction !== "incoming") return;

      messages.push({
        direction,
        participant: participants[threadIndex] || null,
        text,
        thread: threadIndex + 1,
        timestamp: new Date(timestampMs).toISOString(),
        timestampMs,
      });
    });
  });

  messages.sort((left, right) => right.timestampMs - left.timestampMs);
  const selected = messages.slice(0, limit).map(({ timestampMs, ...message }) => message);
  const oldestLoadedThread = Math.min(...latestThreadTimestamps);

  return {
    count: selected.length,
    cutoff: new Date(cutoffMs).toISOString(),
    generatedAt: new Date(now).toISOString(),
    messages: selected,
    sourceTruncated:
      rawThreads.length >= 100 &&
      Number.isFinite(oldestLoadedThread) &&
      oldestLoadedThread >= cutoffMs,
    truncated: messages.length > selected.length,
    windowMs: sinceMs,
  };
}

export async function readMessageThread(page, reference, limit = 100) {
  await navigateToMessages(page);
  const threads = page.locator(MESSAGE_THREAD_SELECTOR);
  await threads.first().waitFor({ state: "attached", timeout: 5_000 });

  const threadCount = await threads.count();
  let selectedIndex;
  if (/^\d+$/.test(reference)) {
    selectedIndex = Number.parseInt(reference, 10) - 1;
  } else {
    const needle = reference.toLocaleLowerCase();
    selectedIndex = -1;
    for (let index = 0; index < threadCount; index += 1) {
      const text = await threads.nth(index).innerText();
      if (text.toLocaleLowerCase().includes(needle)) {
        selectedIndex = index;
        break;
      }
    }
  }
  if (selectedIndex < 0 || selectedIndex >= threadCount) {
    throw new RangeError(`No message thread matches ${JSON.stringify(reference)}.`);
  }

  await threads.nth(selectedIndex).locator("[role=button]").click();
  await page.locator("gv-thread-details gv-message-list").waitFor({
    state: "attached",
    timeout: 5_000,
  });

  return page.evaluate((limit) => {
    const details = document.querySelector("gv-thread-details");
    const clean = (value) => value?.replace(/\s+/g, " ").trim() || null;
    const allMessages = [...details.querySelectorAll("gv-message-item")];
    const messages = allMessages.slice(-limit).map((element) => ({
      attachments: element.querySelectorAll("gv-image-attachment").length,
      sender: clean(element.querySelector(".sender")?.textContent),
      text: clean(element.querySelector("gv-annotation.content")?.textContent),
      timestamp: clean(element.querySelector(".timestamp")?.textContent),
    }));

    return {
      messages,
      participant: clean(
        details.querySelector("gv-thread-details-header .secondary-text")?.textContent,
      ),
      title: clean(
        details.querySelector("gv-thread-details-header .header-title")?.textContent,
      ),
      totalMessages: allMessages.length,
    };
  }, limit);
}

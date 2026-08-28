import { chromium } from "playwright-core";

import { chromeChannel, profileDirectory } from "./config.js";

const READ_ONLY_VOICE_ENDPOINTS = new Set([
  "/voice/v1/voiceclient/account/get",
  "/voice/v1/voiceclient/api2thread/get",
  "/voice/v1/voiceclient/api2thread/list",
  "/voice/v1/voiceclient/getnumberportinfo",
  "/voice/v1/voiceclient/numbertransfer/list",
  "/voice/v1/voiceclient/sipregisterinfo/get",
  "/voice/v1/voiceclient/threadinginfo/get",
]);

export function isReadOnlyVoiceRequest(rawUrl) {
  const url = new URL(rawUrl);
  if (url.hostname !== "clients6.google.com") return true;
  if (!url.pathname.startsWith("/voice/v1/")) return true;
  return READ_ONLY_VOICE_ENDPOINTS.has(url.pathname);
}

export async function openVoiceBrowser({
  env = process.env,
  headless = true,
  readOnly = true,
  viewport = { width: 1280, height: 900 },
} = {}) {
  const context = await chromium.launchPersistentContext(profileDirectory(env), {
    channel: chromeChannel(env),
    headless,
    viewport,
  });

  const blockedRequests = [];
  if (readOnly) {
    await context.route("https://clients6.google.com/voice/v1/**", async (route) => {
      const url = route.request().url();
      if (isReadOnlyVoiceRequest(url)) {
        await route.continue();
      } else {
        blockedRequests.push(new URL(url).pathname);
        await route.abort("blockedbyclient");
      }
    });
  }

  const restoredPages = context.pages();
  const page = await context.newPage();
  await Promise.all(restoredPages.map((restoredPage) => restoredPage.close()));
  page.setDefaultTimeout(15_000);

  return { blockedRequests, context, page };
}

export async function withVoiceBrowser(options, operation) {
  const browser = await openVoiceBrowser(options);
  try {
    return await operation(browser);
  } finally {
    await browser.context.close();
  }
}

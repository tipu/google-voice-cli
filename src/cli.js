#!/usr/bin/env node

import process from "node:process";
import { Command, InvalidArgumentError } from "commander";

import { openVoiceBrowser, withVoiceBrowser } from "./browser.js";
import { VOICE_URL } from "./config.js";
import { parseDuration } from "./duration.js";
import { printItems, printJson, printRecent, printThread } from "./output.js";
import {
  accountStatus,
  AuthenticationRequiredError,
  extractMessageThreads,
  extractRecentMessages,
  messagesUrl,
  readMessageThread,
} from "./voice.js";

const program = new Command();

program
  .name("gvoice")
  .description("Read-only CLI for existing Google Voice text messages")
  .version("0.1.0")
  .showSuggestionAfterError();

program
  .command("login")
  .description("Open Google Voice in a dedicated Chrome profile for manual sign-in")
  .action(async () => {
    const { context, page } = await openVoiceBrowser({ headless: false });
    await page.goto(`${VOICE_URL}/messages`, { waitUntil: "domcontentloaded" });

    process.stdout.write(
      "Complete Google's sign-in and 2-step prompts in Chrome. Close Chrome when finished.\n",
    );
    await context.waitForEvent("close");
  });

program
  .command("status")
  .description("Check the saved Google Voice session")
  .option("--json", "print machine-readable JSON")
  .action(async ({ json }) => {
    const status = await withVoiceBrowser({ headless: true }, ({ page }) =>
      accountStatus(page),
    );
    if (json) printJson(status);
    else {
      process.stdout.write("Signed in to Google Voice\n");
      if (status.accountLabel) process.stdout.write(`${status.accountLabel}\n`);
    }
  });

program
  .command("messages")
  .alias("threads")
  .description("List existing text-message threads")
  .option("-n, --limit <count>", "maximum threads to return", parseLimit, 20)
  .option("--json", "print machine-readable JSON")
  .action(async ({ limit, json }) => {
    const items = await withVoiceBrowser({ headless: true }, ({ page }) =>
      extractMessageThreads(page, limit),
    );
    if (json) printJson(items);
    else printItems(items);
  });

program
  .command("recent")
  .description("Show individual text messages received or sent during a time window")
  .argument("<duration>", "window such as 30m, 24h, 72h, or 7d", parseDurationArgument)
  .option("--incoming", "show only received messages")
  .option("-n, --limit <count>", "maximum messages to return", parseLimit, 100)
  .option("--json", "print machine-readable JSON")
  .action(async (sinceMs, { incoming, limit, json }) => {
    const result = await withVoiceBrowser({ headless: true }, ({ page }) =>
      extractRecentMessages(page, { incomingOnly: incoming, limit, sinceMs }),
    );
    if (json) printJson(result);
    else printRecent(result);
  });

program
  .command("read")
  .description("Read one text thread by 1-based list index or preview text")
  .argument("<thread>", "thread index or case-insensitive preview text")
  .option("-n, --limit <count>", "maximum messages to return", parseLimit, 100)
  .option("--json", "print machine-readable JSON")
  .action(async (thread, { limit, json }) => {
    const result = await withVoiceBrowser({ headless: true }, ({ page }) =>
      readMessageThread(page, thread, limit),
    );
    if (json) printJson(result);
    else printThread(result);
  });

program
  .command("open")
  .description("Open text messages in the dedicated Google Voice profile")
  .action(async () => {
    const { context, page } = await openVoiceBrowser({ headless: false });
    await page.goto(messagesUrl(), { waitUntil: "domcontentloaded" });
    await context.waitForEvent("close");
  });

program
  .command("policy")
  .description("Explain the supported API and automation boundary")
  .action(() => {
    process.stdout.write(
      [
        "Google does not publish an end-user Google Voice API for calls, texts, or inbox history.",
        "This CLI reads your local Google Voice web session and never stores your Google password.",
        "Unknown or state-changing Voice API requests are blocked in the browser transport.",
        "There are no send, call, archive, delete, mark-spam, or settings commands.",
      ].join("\n") + "\n",
    );
  });

program.configureOutput({
  outputError: (message, write) => write(message),
});

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof AuthenticationRequiredError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  } else if (error?.message?.includes("Target page, context or browser has been closed")) {
    process.exitCode = 0;
  } else {
    process.stderr.write(`gvoice: ${error.message}\n`);
    process.exitCode = 1;
  }
}

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new InvalidArgumentError("limit must be an integer from 1 to 100");
  }
  return parsed;
}

function parseDurationArgument(value) {
  try {
    return parseDuration(value);
  } catch (error) {
    throw new InvalidArgumentError(error.message);
  }
}

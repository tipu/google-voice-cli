import os from "node:os";
import path from "node:path";

export const VOICE_URL = "https://voice.google.com/u/0";

export function profileDirectory(env = process.env) {
  return path.resolve(
    env.GVOICE_PROFILE_DIR ||
      path.join(os.homedir(), ".config", "google-voice-cli", "chrome"),
  );
}

export function chromeChannel(env = process.env) {
  return env.GVOICE_CHROME_CHANNEL || "chrome";
}

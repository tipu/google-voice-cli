const DURATION_PATTERN = /^(\d+(?:\.\d+)?)(s|m|h|d|w)$/i;
const UNIT_MILLISECONDS = Object.freeze({
  d: 24 * 60 * 60 * 1_000,
  h: 60 * 60 * 1_000,
  m: 60 * 1_000,
  s: 1_000,
  w: 7 * 24 * 60 * 60 * 1_000,
});

export function parseDuration(value) {
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    throw new TypeError("duration must look like 30m, 24h, 72h, or 7d");
  }

  const milliseconds = Number.parseFloat(match[1]) * UNIT_MILLISECONDS[match[2].toLowerCase()];
  if (!Number.isFinite(milliseconds) || milliseconds < 1_000) {
    throw new RangeError("duration must be at least one second");
  }
  if (milliseconds > 365 * UNIT_MILLISECONDS.d) {
    throw new RangeError("duration cannot exceed 365 days");
  }
  return milliseconds;
}

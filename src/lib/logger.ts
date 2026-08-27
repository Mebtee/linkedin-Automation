import "server-only";

/**
 * Lightweight, privacy-safe operational logging (Phase 4).
 *
 * Centralizes the few places the app logs so we can keep operational
 * visibility without ever leaking secrets. This is NOT a new logging
 * framework — it is a thin wrapper over console for the handful of
 * high-risk paths (OAuth callback, cron publisher) that already log.
 *
 * SAFE to include:
 *   operation name, internal UUIDs (document/post/profile/schedule), status,
 *   duration, coarse error category, provider name, retry count.
 *
 * NEVER include (callers must not pass these):
 *   API keys, OAuth access tokens, client secrets, scheduler secrets,
 *   Authorization headers, signed state values, full PDF body, private
 *   journal contents.
 */
export const log = {
  info(operation: string, fields?: Record<string, unknown>): void {
    console.info(formatLine("info", operation, fields));
  },
  warn(operation: string, fields?: Record<string, unknown>): void {
    console.warn(formatLine("warn", operation, fields));
  },
  error(operation: string, fields?: Record<string, unknown>): void {
    console.error(formatLine("error", operation, fields));
  },
};

function formatLine(
  level: "info" | "warn" | "error",
  operation: string,
  fields?: Record<string, unknown>,
): string {
  const ts = new Date().toISOString();
  const base = `[${level}] ${ts} ${operation}`;
  if (!fields || Object.keys(fields).length === 0) return base;
  return `${base} ${JSON.stringify(fields)}`;
}

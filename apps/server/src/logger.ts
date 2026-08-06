/** Structured application logger construction. */

import pino, { type Logger } from "pino";

/** Create the structured logger shared by HTTP, sessions, and background work. */
/** Create the single JSON logger shared by server services. */
export function createLogger(level: string): Logger {
  return pino({
    level,
    base: { service: "battleship" },
    redact: ["req.headers.authorization"],
  });
}

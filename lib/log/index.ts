import pino from "pino";
import { env } from "@/lib/env";

export const redactionPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.LEARNINGS_AI_TOKEN",
  "*.OPENROUTER_API_KEY",
  "*.SENTRY_DSN",
  "*.password",
  "*.token",
];

export const log = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactionPaths, censor: "[REDACTED]" },
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        },
      }
    : {}),
  base: { service: "learnings-ai" },
});

export type Logger = typeof log;

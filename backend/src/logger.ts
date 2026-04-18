import { config } from "./config.js";

/**
 * Fastify auto-creates a pino logger from this config. We add a redaction
 * list so view keys / API keys never land in logs even if they're accidentally
 * passed through an error object. See CLAUDE.md §9.3.
 */
export const loggerConfig = {
  level: config.LOG_LEVEL,
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, singleLine: true, translateTime: "HH:MM:ss" },
        },
  redact: {
    paths: [
      "req.headers.authorization",
      "*.viewKey",
      "*.CHAINGPT_API_KEY",
      "*.apiKey",
      "headers.authorization",
    ],
    censor: "[redacted]",
  },
};

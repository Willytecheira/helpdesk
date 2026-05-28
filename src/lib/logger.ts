import pino from "pino"

const isDev = process.env.NODE_ENV !== "production"

const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  redact: {
    paths: [
      "*.password",
      "*.apiKey",
      "*.token",
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }
    : {
        // En prod: JSON lines a stdout; los orquestadores (docker logs, systemd) lo capturan
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
})

export { logger }

// Loggers nombrados por subsistema
export const dbLogger = logger.child({ scope: "db" })
export const authLogger = logger.child({ scope: "auth" })
export const aiLogger = logger.child({ scope: "ai" })
export const agentLogger = logger.child({ scope: "agent" })
export const emailLogger = logger.child({ scope: "email" })
export const httpLogger = logger.child({ scope: "http" })

import * as fs from "fs"
import * as path from "path"

import { createLogger, format, transports } from "winston"

const { combine, timestamp, printf } = format

const logFormat = printf((info) => {
  return `${info.timestamp} [${info.level}]: ${info.message}`
})

// Same directory for creation and writing, independent of whether we run from src/ or dist/.
const logsDir = path.join(process.cwd(), "logs")

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Create a logger instance
const logger = createLogger({
  // Keep test output readable; tests assert on responses, not log lines.
  silent: process.env.NODE_ENV === "test",
  level: "info", // Set the log level
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
  transports: [
    new transports.File({
      filename: "error.log", // Name of the log file
      level: "error",
      dirname: logsDir,
      maxsize: 5242880, // Max file size (5MB in bytes)
      maxFiles: 5 // Max number of log files to keep
    }),
    // Always log to stdout so `docker logs` works; colours only outside production.
    new transports.Console({
      format:
        process.env.NODE_ENV === "production"
          ? combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat)
          : combine(format.colorize(), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat)
    })
  ]
})

export { logger }

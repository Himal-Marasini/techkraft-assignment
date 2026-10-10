import { Injectable, NestMiddleware } from "@nestjs/common"
import { NextFunction, Request, Response } from "express"
import { logger, redactUrl } from "src/utils"

/**
 * One log line per request: method, path, status, duration.
 * A middleware (not an interceptor) so requests rejected by guards (401/403) are logged too.
 * Bodies and headers are intentionally not logged; query-string secrets are redacted.
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = process.hrtime.bigint()

    response.on("finish", () => {
      const elapsed = process.hrtime.bigint() - startedAt
      const durationMs = Number(elapsed) / 1e6
      const url = redactUrl(request.originalUrl)
      const line = `${request.method} ${url} ${response.statusCode} ${durationMs.toFixed(1)}ms`

      if (response.statusCode >= 500) logger.error(line)
      else if (response.statusCode >= 400) logger.warn(line)
      else logger.info(line)
    })

    next()
  }
}

import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common"
import { Request, Response } from "express"
import { logger, redact, redactUrl } from "src/utils"
import { EntityNotFoundError, QueryFailedError } from "typeorm"

interface ErrorBody {
  status: number
  message: string
  details?: string[]
}

const POSTGRES_ERRORS: Record<string, ErrorBody> = {
  "23505": { status: HttpStatus.CONFLICT, message: "Resource already exists" },
  "23503": { status: HttpStatus.CONFLICT, message: "Referenced resource does not exist or is still in use" },
  "23502": { status: HttpStatus.BAD_REQUEST, message: "Invalid value provided" },
  "23514": { status: HttpStatus.BAD_REQUEST, message: "Invalid value provided" },
  "22P02": { status: HttpStatus.BAD_REQUEST, message: "Invalid value provided" }
}

/**
 * Single place where every error becomes an HTTP response: `{ success: false, message, details? }`.
 * Unexpected errors are logged with their stack but the client only ever sees a generic message,
 * so internals (SQL, stack traces, driver details containing row values) never leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const request = context.getRequest<Request>()
    const response = context.getResponse<Response>()

    const { status, message, details } = this.toErrorBody(exception)

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : String(exception)
      const url = redactUrl(request.originalUrl)
      const body = redact(request.body)
      logger.error(`${request.method} ${url} body=${JSON.stringify(body)}\n${stack}`)
    }

    response.status(status).json({ success: false, message, ...(details && { details }) })
  }

  private toErrorBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()

      if (typeof body === "string") return { status, message: body }

      const { message } = body as { message?: string | string[] }
      // ValidationPipe reports one string per failed constraint.
      if (Array.isArray(message)) return { status, message: "Validation failed", details: message }
      return { status, message: message ?? exception.message }
    }

    if (exception instanceof EntityNotFoundError) {
      return { status: HttpStatus.NOT_FOUND, message: "Record not found" }
    }

    if (exception instanceof QueryFailedError) {
      const { code } = exception.driverError as { code?: string }
      const known = code && POSTGRES_ERRORS[code]
      if (known) return known
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Internal Server Error" }
  }
}

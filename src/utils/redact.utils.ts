export const REDACTED = "[REDACTED]"

// Matched as a case-insensitive substring of the key, so "newPassword",
// "passwordHash", "accessToken", "x-api-key" and "taxId" are all covered.
const SENSITIVE_KEY_PATTERN = /password|token|secret|authorization|cookie|api[-_]?key|tax[-_]?id/i

/** Returns a deep copy of `value` with every sensitive field replaced, safe to write to logs. */
export function redact<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redact(item)) as T
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map((entry) => {
        const key = entry[0]
        const field = entry[1]
        return [key, SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(field)]
      })
    ) as T
  }

  return value
}

/** Redacts sensitive query-string values, e.g. "/x?token=abc" -> "/x?token=[REDACTED]". */
export function redactUrl(url: string): string {
  const [path, query] = url.split("?", 2)
  if (!query) return url

  const params = query.split("&").map((pair) => {
    const [key] = pair.split("=", 1)
    const decodedKey = decodeURIComponent(key)
    return SENSITIVE_KEY_PATTERN.test(decodedKey) ? `${key}=${REDACTED}` : pair
  })
  return `${path}?${params.join("&")}`
}

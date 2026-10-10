import { redact, REDACTED, redactUrl } from "../redact.utils"

describe("redact", () => {
  it("masks sensitive keys at any depth and keeps other fields", () => {
    const input = {
      email: "owner@example.com",
      password: "hunter2",
      nested: { accessToken: "abc", items: [{ apiKey: "k", amount: 10 }] }
    }

    expect(redact(input)).toEqual({
      email: "owner@example.com",
      password: REDACTED,
      nested: { accessToken: REDACTED, items: [{ apiKey: REDACTED, amount: 10 }] }
    })
  })

  it("does not mutate the original object", () => {
    const input = { password: "hunter2" }

    redact(input)

    expect(input.password).toBe("hunter2")
  })
})

describe("redactUrl", () => {
  it("masks sensitive query params only", () => {
    expect(redactUrl("/api/v1/x?token=abc&page=2")).toBe(`/api/v1/x?token=${REDACTED}&page=2`)
  })

  it("leaves urls without a query untouched", () => {
    expect(redactUrl("/api/v1/x")).toBe("/api/v1/x")
  })
})

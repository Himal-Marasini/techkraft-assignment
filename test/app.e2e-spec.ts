import { INestApplication } from "@nestjs/common"
import request from "supertest"

import { createTestApp } from "./utils/create-test-app"

describe("App (e2e)", () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await createTestApp()
  })

  afterAll(async () => {
    await app.close()
  })

  it("unknown routes return the standard error shape", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/does-not-exist").expect(404)

    expect(response.body).toEqual({ success: false, message: "Cannot GET /api/v1/does-not-exist" })
  })
})

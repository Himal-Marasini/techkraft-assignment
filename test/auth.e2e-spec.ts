import { INestApplication } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { Role } from "src/modules/users/users.constant"

import { createTestApp } from "./utils/create-test-app"
import { api, createUser, resetState, TEST_PASSWORD, TestUser } from "./utils/fixtures"

describe("Auth (e2e)", () => {
  let app: INestApplication
  let sales: TestUser

  beforeAll(async () => {
    app = await createTestApp()
    await resetState(app)
    sales = await createUser(app, Role.SALES, "auth-sales")
  })

  afterAll(async () => {
    await app.close()
  })

  describe("POST /auth/login", () => {
    it("issues a JWT and returns the user without the password hash", async () => {
      const response = await api(app)
        .post("/auth/login", { email: "AUTH-SALES@techkraft.test", password: TEST_PASSWORD })
        .expect(201)

      expect(response.body.data).toMatchObject({ user: { email: sales.email, role: "SALES" } })
      expect(response.body.data.accessToken).toEqual(expect.any(String))
      expect(JSON.stringify(response.body)).not.toContain("passwordHash")
    })

    it("returns the same 401 for a wrong password and an unknown email", async () => {
      const wrongPassword = await api(app).post("/auth/login", { email: sales.email, password: "wrong" }).expect(401)
      const unknownEmail = await api(app)
        .post("/auth/login", { email: "nobody@techkraft.test", password: TEST_PASSWORD })
        .expect(401)

      expect(wrongPassword.body).toEqual(unknownEmail.body)
    })

    it("validates the payload", async () => {
      await api(app).post("/auth/login", { email: "not-an-email" }).expect(400)
    })
  })

  describe("JWT route protection", () => {
    it("rejects requests without a token", async () => {
      await api(app).get("/merchant-applications").expect(401)
    })

    it("rejects a malformed token", async () => {
      await api(app, { ...sales, token: "not.a.jwt" })
        .get("/merchant-applications")
        .expect(401)
    })

    it("rejects a token signed with a different secret", async () => {
      const forged = new JwtService().sign(
        { sub: sales.id, email: sales.email, role: Role.ADMIN },
        { secret: "attacker-controlled-secret-that-is-long-enough" }
      )

      await api(app, { ...sales, token: forged })
        .get("/merchant-applications")
        .expect(401)
    })

    it("rejects an expired token", async () => {
      const expired = app
        .get(JwtService)
        .sign({ sub: sales.id, email: sales.email, role: sales.role }, { expiresIn: -10 })

      await api(app, { ...sales, token: expired })
        .get("/merchant-applications")
        .expect(401)
    })

    it("accepts a valid token", async () => {
      await api(app, sales).get("/merchant-applications").expect(200)
    })
  })
})

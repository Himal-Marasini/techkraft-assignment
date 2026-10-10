import { getQueueToken } from "@nestjs/bullmq"
import { INestApplication } from "@nestjs/common"
import * as bcrypt from "bcryptjs"
import { Queue } from "bullmq"
import { CreateMerchantApplicationDTO } from "src/modules/merchant-applications/merchant-applications.dto"
import { RISK_REVIEW_QUEUE } from "src/modules/risk-review/risk-review.constant"
import { User } from "src/modules/users/user.entity"
import { Role } from "src/modules/users/users.constant"
import request from "supertest"
import { DataSource } from "typeorm"

export const TEST_PASSWORD = "Test-Password-123"

export interface TestUser {
  id: string
  email: string
  role: Role
  token: string
}

/** Empties every table and the risk-review queue so each suite starts clean. */
export async function resetState(app: INestApplication) {
  await app
    .get(DataSource)
    .query("TRUNCATE audit_logs, risk_assessments, merchant_applications, users RESTART IDENTITY CASCADE")
  await app.get<Queue>(getQueueToken(RISK_REVIEW_QUEUE)).obliterate({ force: true })
}

/** Inserts a user directly and logs in through the real API to get a token. */
export async function createUser(app: INestApplication, role: Role, name: string): Promise<TestUser> {
  const email = `${name}@techkraft.test`
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4)
  const user = await app.get(DataSource).getRepository(User).save({ email, role, passwordHash })

  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: TEST_PASSWORD })
    .expect(201)

  return { id: user.id, email, role, token: response.body.data.accessToken }
}

export function applicationPayload(overrides: Partial<CreateMerchantApplicationDTO> = {}) {
  return {
    businessName: "Everest Coffee House",
    legalBusinessName: "Everest Coffee House Pvt. Ltd.",
    businessType: "PARTNERSHIP",
    taxId: "00-1234567",
    ownerFullName: "Jane Example",
    ownerEmail: "jane.owner@example.com",
    expectedMonthlyVolume: 50000,
    averageTicketSize: 45.5,
    ...overrides
  }
}

/** Typed shortcut for authenticated supertest calls. */
export function api(app: INestApplication, user?: TestUser) {
  const server = app.getHttpServer()
  const withAuth = (test: request.Test) => (user ? test.set("Authorization", `Bearer ${user.token}`) : test)

  return {
    get: (path: string) => withAuth(request(server).get(`/api/v1${path}`)),
    post: (path: string, body?: object) => withAuth(request(server).post(`/api/v1${path}`)).send(body),
    patch: (path: string, body?: object) => withAuth(request(server).patch(`/api/v1${path}`)).send(body)
  }
}

export async function createApplication(app: INestApplication, owner: TestUser, overrides = {}) {
  const response = await api(app, owner).post("/merchant-applications", applicationPayload(overrides)).expect(201)
  return response.body.data as { id: string; status: string }
}

/** Polls until the background worker has finished the risk check, i.e. it is no longer PENDING/PROCESSING. */
export async function waitForRiskReview(app: INestApplication, user: TestUser, id: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const response = await api(app, user).get(`/merchant-applications/${id}`).expect(200)
    if (!["PENDING", "PROCESSING"].includes(response.body.data.riskStatus)) return response.body.data
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Risk review for ${id} did not finish within ${timeoutMs}ms`)
}

import { INestApplication } from "@nestjs/common"
import { Role } from "src/modules/users/users.constant"
import { DataSource } from "typeorm"

import { createTestApp } from "./utils/create-test-app"
import {
  api,
  applicationPayload,
  createApplication,
  createUser,
  resetState,
  TestUser,
  waitForRiskReview
} from "./utils/fixtures"

/**
 * Explicit bypass attempts. Each test acts as the "wrong" user and asserts both the HTTP
 * response and that nothing changed in the database.
 */
describe("Authorization rules cannot be bypassed (e2e)", () => {
  let app: INestApplication
  let admin: TestUser
  let reviewer: TestUser
  let otherReviewer: TestUser
  let owner: TestUser
  let otherSales: TestUser
  let applicationId: string

  const loadApplication = (id: string) =>
    app
      .get(DataSource)
      .query("SELECT status, business_name, assigned_reviewer_id FROM merchant_applications WHERE id = $1", [id])

  beforeAll(async () => {
    app = await createTestApp()
    await resetState(app)
    admin = await createUser(app, Role.ADMIN, "authz-admin")
    reviewer = await createUser(app, Role.REVIEWER, "authz-reviewer")
    otherReviewer = await createUser(app, Role.REVIEWER, "authz-reviewer-2")
    owner = await createUser(app, Role.SALES, "authz-owner")
    otherSales = await createUser(app, Role.SALES, "authz-other-sales")
  })

  beforeEach(async () => {
    applicationId = (await createApplication(app, owner)).id
  })

  afterAll(async () => {
    await app.close()
  })

  describe("SALES object-level isolation", () => {
    it("cannot read another SALES user's application by id", async () => {
      const response = await api(app, otherSales).get(`/merchant-applications/${applicationId}`).expect(404)

      expect(response.body).toEqual({ success: false, message: "Merchant application not found" })
    })

    it("gets the same 404 for someone else's application as for one that doesn't exist", async () => {
      const foreign = await api(app, otherSales).get(`/merchant-applications/${applicationId}`)
      const missing = await api(app, otherSales).get("/merchant-applications/00000000-0000-4000-8000-000000000000")

      expect(foreign.status).toBe(missing.status)
      expect(foreign.body).toEqual(missing.body)
    })

    it("cannot update another SALES user's application by id", async () => {
      await api(app, otherSales)
        .patch(`/merchant-applications/${applicationId}`, { businessName: "Hijacked" })
        .expect(404)

      const [row] = await loadApplication(applicationId)
      expect(row.business_name).toBe("Everest Coffee House")
    })

    it("cannot submit another SALES user's application", async () => {
      await api(app, otherSales).post(`/merchant-applications/${applicationId}/submit`).expect(404)

      const [row] = await loadApplication(applicationId)
      expect(row.status).toBe("DRAFT")
    })

    it("only sees their own applications when listing, even when filtering", async () => {
      await createApplication(app, otherSales, { businessName: "Other Sales Shop" })

      const response = await api(app, otherSales).get("/merchant-applications?status=DRAFT").expect(200)

      expect(response.body.data.every((item: { createdById: string }) => item.createdById === otherSales.id)).toBe(true)
      expect(response.body.data.map((item: { id: string }) => item.id)).not.toContain(applicationId)
    })

    it("cannot assign a reviewer or record a decision", async () => {
      await api(app, owner)
        .post(`/merchant-applications/${applicationId}/assign`, { reviewerId: reviewer.id })
        .expect(403)
      await api(app, owner)
        .post(`/merchant-applications/${applicationId}/decision`, { decision: "APPROVED" })
        .expect(403)
    })

    it("cannot approve by sending status in the body (mass assignment)", async () => {
      await api(app, owner)
        .patch(`/merchant-applications/${applicationId}`, { status: "APPROVED", assignedReviewerId: owner.id })
        .expect(400)
      await api(app, owner)
        .post("/merchant-applications", { ...applicationPayload(), status: "APPROVED", createdById: otherSales.id })
        .expect(400)

      const [row] = await loadApplication(applicationId)
      expect(row.status).toBe("DRAFT")
    })
  })

  describe("review decision is limited to the assigned REVIEWER", () => {
    beforeEach(async () => {
      await api(app, owner).post(`/merchant-applications/${applicationId}/submit`).expect(202)
      await waitForRiskReview(app, owner, applicationId)
      await api(app, admin)
        .post(`/merchant-applications/${applicationId}/assign`, { reviewerId: reviewer.id })
        .expect(200)
    })

    it("hides the application from a reviewer who is not assigned (404) and rejects their decision", async () => {
      await api(app, otherReviewer).get(`/merchant-applications/${applicationId}`).expect(404)
      await api(app, otherReviewer)
        .post(`/merchant-applications/${applicationId}/decision`, { decision: "REJECTED", reason: "Not mine to decide" })
        .expect(404)

      const [row] = await loadApplication(applicationId)
      expect(row.status).toBe("UNDER_REVIEW")
    })

    it("rejects a decision from ADMIN", async () => {
      await api(app, admin)
        .post(`/merchant-applications/${applicationId}/decision`, { decision: "REJECTED", reason: "Admin override" })
        .expect(403)
    })

    it("allows the assigned reviewer", async () => {
      await api(app, reviewer)
        .post(`/merchant-applications/${applicationId}/decision`, { decision: "REJECTED", reason: "Incomplete KYB" })
        .expect(200)
    })
  })

  describe("role checks", () => {
    it("REVIEWER cannot create, edit or submit applications", async () => {
      await api(app, reviewer).post("/merchant-applications", applicationPayload()).expect(403)
      await api(app, reviewer).patch(`/merchant-applications/${applicationId}`, { businessName: "x" }).expect(403)
      await api(app, reviewer).post(`/merchant-applications/${applicationId}/submit`).expect(403)
    })

    it("REVIEWER cannot assign reviewers (not even themselves)", async () => {
      await api(app, owner).post(`/merchant-applications/${applicationId}/submit`).expect(202)

      await api(app, reviewer)
        .post(`/merchant-applications/${applicationId}/assign`, { reviewerId: reviewer.id })
        .expect(403)

      const [row] = await loadApplication(applicationId)
      expect(row.assigned_reviewer_id).toBeNull()
    })

    it("ADMIN cannot assign a non-reviewer as reviewer", async () => {
      await api(app, owner).post(`/merchant-applications/${applicationId}/submit`).expect(202)
      await waitForRiskReview(app, owner, applicationId)

      await api(app, admin).post(`/merchant-applications/${applicationId}/assign`, { reviewerId: owner.id }).expect(400)
    })
  })
})

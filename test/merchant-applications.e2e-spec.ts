import { INestApplication } from "@nestjs/common"
import { RiskReviewProcessor } from "src/modules/risk-review/risk-review.processor"
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

describe("Merchant application lifecycle (e2e)", () => {
  let app: INestApplication
  let admin: TestUser
  let reviewer: TestUser
  let sales: TestUser

  beforeAll(async () => {
    app = await createTestApp()
    await resetState(app)
    admin = await createUser(app, Role.ADMIN, "life-admin")
    reviewer = await createUser(app, Role.REVIEWER, "life-reviewer")
    sales = await createUser(app, Role.SALES, "life-sales")
  })

  afterAll(async () => {
    await app.close()
  })

  const submitAndAssign = async (id: string) => {
    await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)
    await waitForRiskReview(app, sales, id)
    await api(app, admin).post(`/merchant-applications/${id}/assign`, { reviewerId: reviewer.id }).expect(200)
  }

  it("runs the full happy path: create → update → submit → risk review → assign → approve", async () => {
    const created = await api(app, sales).post("/merchant-applications", applicationPayload()).expect(201)
    const id = created.body.data.id
    expect(created.body.data).toMatchObject({ status: "DRAFT", riskStatus: null, createdById: sales.id })

    await api(app, sales).patch(`/merchant-applications/${id}`, { businessName: "Everest Coffee Co" }).expect(200)

    const submitted = await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)
    expect(submitted.body.data).toMatchObject({ status: "SUBMITTED", riskStatus: "PENDING", submissionVersion: 1 })

    const reviewed = await waitForRiskReview(app, sales, id)
    expect(reviewed).toMatchObject({ status: "UNDER_REVIEW", riskStatus: "PASSED" })

    const assigned = await api(app, admin)
      .post(`/merchant-applications/${id}/assign`, { reviewerId: reviewer.id })
      .expect(200)
    expect(assigned.body.data).toMatchObject({ status: "UNDER_REVIEW", assignedReviewerId: reviewer.id })

    const approved = await api(app, reviewer)
      .post(`/merchant-applications/${id}/decision`, { decision: "APPROVED" })
      .expect(200)
    expect(approved.body.data).toMatchObject({ status: "APPROVED", businessName: "Everest Coffee Co" })
  })

  it("supports request-info → edit → resubmit, which comes back UNDER_REVIEW to the same reviewer", async () => {
    const { id } = await createApplication(app, sales)
    await submitAndAssign(id)

    const infoRequested = await api(app, reviewer)
      .post(`/merchant-applications/${id}/decision`, { decision: "INFO_REQUESTED", reason: "Need a bank statement" })
      .expect(200)
    expect(infoRequested.body.data).toMatchObject({ status: "INFO_REQUESTED", reviewNote: "Need a bank statement" })

    await api(app, sales).patch(`/merchant-applications/${id}`, { averageTicketSize: 50 }).expect(200)

    const resubmitted = await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)
    expect(resubmitted.body.data).toMatchObject({
      status: "SUBMITTED",
      riskStatus: "PENDING",
      submissionVersion: 2,
      assignedReviewerId: reviewer.id
    })

    const reviewedAgain = await waitForRiskReview(app, sales, id)
    expect(reviewedAgain).toMatchObject({ status: "UNDER_REVIEW", riskStatus: "PASSED", assignedReviewerId: reviewer.id })
  })

  describe("invalid state transitions are rejected with 409", () => {
    it("cannot edit or resubmit once submitted", async () => {
      const { id } = await createApplication(app, sales)
      await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)

      await api(app, sales).patch(`/merchant-applications/${id}`, { businessName: "Late change" }).expect(409)
      await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(409)
    })

    it("cannot assign a reviewer to a DRAFT", async () => {
      const { id } = await createApplication(app, sales)

      await api(app, admin).post(`/merchant-applications/${id}/assign`, { reviewerId: reviewer.id }).expect(409)
    })

    it("can assign while the risk check is still running (SUBMITTED), but no decision until UNDER_REVIEW", async () => {
      // Pause the worker so the application is guaranteed to still be SUBMITTED.
      const worker = app.get(RiskReviewProcessor).worker
      await worker.pause()

      try {
        const { id } = await createApplication(app, sales)
        await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)

        const assigned = await api(app, admin)
          .post(`/merchant-applications/${id}/assign`, { reviewerId: reviewer.id })
          .expect(200)
        expect(assigned.body.data).toMatchObject({ status: "SUBMITTED", assignedReviewerId: reviewer.id })

        const response = await api(app, reviewer)
          .post(`/merchant-applications/${id}/decision`, { decision: "REJECTED", reason: "Too early" })
          .expect(409)
        expect(response.body.message).toContain("UNDER_REVIEW")
      } finally {
        worker.resume()
      }
    })

    it("cannot approve when the risk check FAILED, but can still reject", async () => {
      // 2M volume + 6k tickets scores HIGH → riskStatus FAILED.
      const { id } = await createApplication(app, sales, { expectedMonthlyVolume: 2_000_000, averageTicketSize: 6_000 })
      await submitAndAssign(id)

      const response = await api(app, reviewer)
        .post(`/merchant-applications/${id}/decision`, { decision: "APPROVED" })
        .expect(409)
      expect(response.body.message).toContain("PASSED")

      await api(app, reviewer)
        .post(`/merchant-applications/${id}/decision`, { decision: "REJECTED", reason: "Risk check failed" })
        .expect(200)
    })

    it("cannot decide twice or touch a final application", async () => {
      const { id } = await createApplication(app, sales)
      await submitAndAssign(id)
      await api(app, reviewer)
        .post(`/merchant-applications/${id}/decision`, { decision: "REJECTED", reason: "High chargeback risk" })
        .expect(200)

      await api(app, reviewer).post(`/merchant-applications/${id}/decision`, { decision: "APPROVED" }).expect(409)
      await api(app, sales).patch(`/merchant-applications/${id}`, { businessName: "x" }).expect(409)
      await api(app, admin).post(`/merchant-applications/${id}/assign`, { reviewerId: reviewer.id }).expect(409)
    })

    it("requires a reason when rejecting or requesting info", async () => {
      const { id } = await createApplication(app, sales)
      await submitAndAssign(id)

      await api(app, reviewer).post(`/merchant-applications/${id}/decision`, { decision: "REJECTED" }).expect(400)
    })
  })

  describe("update validation", () => {
    it("rejects an explicit null with 400 and leaves the application unchanged", async () => {
      const { id } = await createApplication(app, sales)

      await api(app, sales).patch(`/merchant-applications/${id}`, { businessName: null }).expect(400)

      const after = await api(app, sales).get(`/merchant-applications/${id}`).expect(200)
      expect(after.body.data.businessName).toBe("Everest Coffee House")
    })
  })

  describe("list", () => {
    it("filters by status and paginates", async () => {
      const response = await api(app, admin).get("/merchant-applications?status=DRAFT&page=1&pageSize=2").expect(200)

      expect(response.body.data.length).toBeLessThanOrEqual(2)
      expect(response.body.data.every((item: { status: string }) => item.status === "DRAFT")).toBe(true)
      expect(response.body.totalCount).toBeGreaterThanOrEqual(response.body.data.length)
    })

    it("rejects invalid filters and page sizes", async () => {
      await api(app, admin).get("/merchant-applications?status=NOPE").expect(400)
      await api(app, admin).get("/merchant-applications?pageSize=500").expect(400)
    })
  })

  describe("sensitive data", () => {
    it("never returns the full tax id, only a masked version", async () => {
      const created = await api(app, sales).post("/merchant-applications", applicationPayload()).expect(201)

      expect(created.body.data).not.toHaveProperty("taxId")
      expect(created.body.data.taxIdMasked).toBe("******4567")
      expect(JSON.stringify(created.body)).not.toContain("00-1234567")
    })
  })

  describe("audit trail", () => {
    it("records creation, submission, assignment and decision without PII", async () => {
      const { id } = await createApplication(app, sales)
      await api(app, sales).patch(`/merchant-applications/${id}`, { ownerEmail: "new.owner@example.com" }).expect(200)
      await submitAndAssign(id)
      await api(app, reviewer).post(`/merchant-applications/${id}/decision`, { decision: "APPROVED" }).expect(200)

      const rows: { action: string; actor_id: string | null; metadata: object }[] = await app
        .get(DataSource)
        .query("SELECT action, actor_id, metadata FROM audit_logs WHERE application_id = $1 ORDER BY created_at", [id])

      expect(rows.map((row) => row.action)).toEqual([
        "APPLICATION_CREATED",
        "APPLICATION_UPDATED",
        "APPLICATION_SUBMITTED",
        "RISK_REVIEW_COMPLETED",
        "REVIEWER_ASSIGNED",
        "DECISION_RECORDED"
      ])
      expect(rows.find((row) => row.action === "REVIEWER_ASSIGNED")?.actor_id).toBe(admin.id)
      expect(rows.find((row) => row.action === "RISK_REVIEW_COMPLETED")?.actor_id).toBeNull()

      const serialized = JSON.stringify(rows)
      expect(serialized).toContain("ownerEmail") // field name is recorded...
      expect(serialized).not.toContain("new.owner@example.com") // ...its value is not
      expect(serialized).not.toContain("00-1234567")
    })
  })
})

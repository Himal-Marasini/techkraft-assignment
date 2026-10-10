import { getQueueToken } from "@nestjs/bullmq"
import { INestApplication } from "@nestjs/common"
import { Queue } from "bullmq"
import { RISK_REVIEW_QUEUE } from "src/modules/risk-review/risk-review.constant"
import { RiskReviewCron } from "src/modules/risk-review/risk-review.cron"
import { RiskReviewProcessor } from "src/modules/risk-review/risk-review.processor"
import { RiskReviewService } from "src/modules/risk-review/risk-review.service"
import { Role } from "src/modules/users/users.constant"
import { DataSource } from "typeorm"

import { createTestApp } from "./utils/create-test-app"
import { api, createApplication, createUser, resetState, TestUser, waitForRiskReview } from "./utils/fixtures"

describe("Asynchronous risk review (e2e)", () => {
  let app: INestApplication
  let sales: TestUser

  const countAssessments = async (id: string) =>
    Number(
      (
        await app
          .get(DataSource)
          .query("SELECT count(*)::int AS count FROM risk_assessments WHERE application_id = $1", [id])
      )[0].count
    )

  beforeAll(async () => {
    app = await createTestApp()
    await resetState(app)
    sales = await createUser(app, Role.SALES, "risk-sales")
  })

  afterAll(async () => {
    await app.close()
  })

  it("submitting enqueues a job; the worker persists the result and moves the application to UNDER_REVIEW", async () => {
    const { id } = await createApplication(app, sales, { expectedMonthlyVolume: 2_000_000, averageTicketSize: 6_000 })

    await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)
    const reviewed = await waitForRiskReview(app, sales, id)

    // Score 75 → HIGH → the automated check FAILED; a reviewer still decides.
    expect(reviewed).toMatchObject({ status: "UNDER_REVIEW", riskStatus: "FAILED" })

    const [assessment] = await app
      .get(DataSource)
      .query("SELECT submission_version, score, level FROM risk_assessments WHERE application_id = $1", [id])
    expect(assessment).toMatchObject({ submission_version: 1, score: 75, level: "HIGH" })
  })

  it("is idempotent: re-enqueuing or re-processing the same submission changes nothing", async () => {
    const { id } = await createApplication(app, sales)
    await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)
    const first = await waitForRiskReview(app, sales, id)

    const riskReview = app.get(RiskReviewService)
    // Duplicate delivery of the same job, and a direct re-run of the worker logic.
    await riskReview.enqueue(id, 1)
    await expect(riskReview.processRiskCheck({ applicationId: id, submissionVersion: 1 })).resolves.toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const after = (await api(app, sales).get(`/merchant-applications/${id}`).expect(200)).body.data
    expect(after).toMatchObject({ riskStatus: first.riskStatus, updatedAt: first.updatedAt })
    expect(await countAssessments(id)).toBe(1)
  })

  it("ignores a stale job from an older submission", async () => {
    const { id } = await createApplication(app, sales)
    await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)
    await waitForRiskReview(app, sales, id)

    await expect(
      app.get(RiskReviewService).processRiskCheck({ applicationId: id, submissionVersion: 0 })
    ).resolves.toBe(false)
    expect(await countAssessments(id)).toBe(1)
  })

  it("on exhausted retries marks the check ERROR and still moves the application to UNDER_REVIEW", async () => {
    // Pause the worker so the check is still PENDING when we simulate the final failure.
    const worker = app.get(RiskReviewProcessor).worker
    await worker.pause()

    try {
      const { id } = await createApplication(app, sales)
      await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)

      await app.get(RiskReviewService).markError({ applicationId: id, submissionVersion: 1 }, "provider timeout")

      const after = (await api(app, sales).get(`/merchant-applications/${id}`).expect(200)).body.data
      expect(after).toMatchObject({ status: "UNDER_REVIEW", riskStatus: "ERROR" })
      expect(await countAssessments(id)).toBe(0)
    } finally {
      worker.resume()
    }
  })

  it("requeues a submission whose job was lost", async () => {
    const queue = app.get<Queue>(getQueueToken(RISK_REVIEW_QUEUE))
    const worker = app.get(RiskReviewProcessor).worker
    await worker.pause()

    const { id } = await createApplication(app, sales)
    await api(app, sales).post(`/merchant-applications/${id}/submit`).expect(202)

    // Lose the job (submit doesn't wait for it, so wait until it exists) and age the submission.
    while (!(await queue.getJob(`${id}-v1`))) await new Promise((resolve) => setTimeout(resolve, 20))
    await queue.remove(`${id}-v1`)
    expect(await queue.getJob(`${id}-v1`)).toBeUndefined()
    await app
      .get(DataSource)
      .query("UPDATE merchant_applications SET updated_at = now() - interval '3 minutes' WHERE id = $1", [id])

    await app.get(RiskReviewCron).requeuePending()
    worker.resume()

    const reviewed = await waitForRiskReview(app, sales, id)
    expect(reviewed).toMatchObject({ status: "UNDER_REVIEW", riskStatus: "PASSED" })
    expect(await countAssessments(id)).toBe(1)
  })
})

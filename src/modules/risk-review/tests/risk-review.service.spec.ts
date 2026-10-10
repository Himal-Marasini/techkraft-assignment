import { Queue } from "bullmq"

import { AuditAction } from "../../audit/audit.constant"
import { MerchantApplication } from "../../merchant-applications/merchant-application.entity"
import {
  ApplicationStatus,
  BusinessType,
  RiskLevel,
  RiskStatus
} from "../../merchant-applications/merchant-applications.constant"
import { RiskProviderService } from "../risk-provider.service"
import { IRiskReviewJobData } from "../risk-review.interface"
import { RiskReviewRepository } from "../risk-review.repository"
import { RiskReviewService } from "../risk-review.service"

const job: IRiskReviewJobData = { applicationId: "app-1", submissionVersion: 2 }
const providerResult = {
  score: 10,
  level: RiskLevel.LOW,
  checks: { volume: "NORMAL", ticketSize: "NORMAL", businessType: BusinessType.PARTNERSHIP }
}

function processingApplication() {
  return Object.assign(new MerchantApplication(), {
    id: job.applicationId,
    submissionVersion: job.submissionVersion,
    status: ApplicationStatus.SUBMITTED,
    riskStatus: RiskStatus.PROCESSING,
    businessType: BusinessType.PARTNERSHIP,
    expectedMonthlyVolume: 50_000,
    averageTicketSize: 45
  })
}

describe("RiskReviewService", () => {
  let repository: jest.Mocked<RiskReviewRepository>
  let provider: jest.Mocked<RiskProviderService>
  let queue: jest.Mocked<Queue>
  let service: RiskReviewService

  beforeEach(() => {
    repository = {
      markProcessing: jest.fn().mockResolvedValue(true),
      findApplication: jest.fn().mockResolvedValue(processingApplication()),
      completeRiskReview: jest.fn().mockResolvedValue(true),
      markRiskReviewError: jest.fn().mockResolvedValue(true)
    } as unknown as jest.Mocked<RiskReviewRepository>
    provider = { assess: jest.fn().mockResolvedValue(providerResult) } as unknown as jest.Mocked<RiskProviderService>
    queue = { add: jest.fn().mockResolvedValue(undefined), on: jest.fn() } as unknown as jest.Mocked<Queue>

    service = new RiskReviewService(queue, repository, provider)
  })

  it("enqueues with a deterministic jobId so duplicate submits are de-duplicated by BullMQ", async () => {
    await service.enqueue("app-1", 2)

    expect(queue.add).toHaveBeenCalledWith(expect.any(String), job, { jobId: "app-1-v2" })
  })

  it("marks the check PROCESSING before calling the provider", async () => {
    await service.processRiskCheck(job)

    expect(repository.markProcessing).toHaveBeenCalledWith(job)
  })

  it.each([
    [RiskLevel.LOW, RiskStatus.PASSED],
    [RiskLevel.HIGH, RiskStatus.FAILED]
  ])("stores a %s risk level as %s with a system audit entry", async (level, riskStatus) => {
    provider.assess.mockResolvedValue({ ...providerResult, level })

    await expect(service.processRiskCheck(job)).resolves.toBe(true)

    expect(repository.completeRiskReview).toHaveBeenCalledWith({
      applicationId: "app-1",
      submissionVersion: 2,
      result: { ...providerResult, level },
      riskStatus,
      audit: expect.objectContaining({ action: AuditAction.RISK_REVIEW_COMPLETED, actorId: null })
    })
  })

  describe("idempotency", () => {
    it("skips without calling the provider when the submission is superseded or already finished", async () => {
      repository.markProcessing.mockResolvedValue(false)

      await expect(service.processRiskCheck(job)).resolves.toBe(false)

      expect(provider.assess).not.toHaveBeenCalled()
      expect(repository.completeRiskReview).not.toHaveBeenCalled()
    })

    it("returns false if a concurrent run completed it first (guarded update matched 0 rows)", async () => {
      repository.completeRiskReview.mockResolvedValue(false)

      await expect(service.processRiskCheck(job)).resolves.toBe(false)
    })
  })

  it("lets provider errors propagate so BullMQ retries the job with backoff", async () => {
    provider.assess.mockRejectedValue(new Error("provider timeout"))

    await expect(service.processRiskCheck(job)).rejects.toThrow("provider timeout")

    expect(repository.completeRiskReview).not.toHaveBeenCalled()
  })

  it("marks the risk check ERROR with an audit entry once retries are exhausted", async () => {
    await service.markError(job, "provider timeout")

    expect(repository.markRiskReviewError).toHaveBeenCalledWith({
      applicationId: "app-1",
      submissionVersion: 2,
      audit: expect.objectContaining({ action: AuditAction.RISK_REVIEW_ERROR, actorId: null })
    })
  })
})

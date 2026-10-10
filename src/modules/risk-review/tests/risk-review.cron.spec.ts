import { MerchantApplication } from "../../merchant-applications/merchant-application.entity"
import { RiskReviewCron } from "../risk-review.cron"
import { RiskReviewRepository } from "../risk-review.repository"
import { RiskReviewService } from "../risk-review.service"

describe("RiskReviewCron.requeuePending", () => {
  let repository: jest.Mocked<RiskReviewRepository>
  let service: jest.Mocked<RiskReviewService>
  let cron: RiskReviewCron

  beforeEach(() => {
    repository = { findPendingSince: jest.fn().mockResolvedValue([]) } as unknown as jest.Mocked<RiskReviewRepository>
    service = { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<RiskReviewService>
    cron = new RiskReviewCron(repository, service)
  })

  it("queues a job again for submissions still PENDING after two minutes", async () => {
    const pending = Object.assign(new MerchantApplication(), { id: "app-1", submissionVersion: 2 })
    repository.findPendingSince.mockResolvedValue([pending])

    await cron.requeuePending()

    const since = repository.findPendingSince.mock.calls[0][0]
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(120_000)
    expect(service.enqueue).toHaveBeenCalledWith("app-1", 2)
  })

  it("does not throw when the lookup fails", async () => {
    repository.findPendingSince.mockRejectedValue(new Error("db down"))

    await expect(cron.requeuePending()).resolves.toBeUndefined()
    expect(service.enqueue).not.toHaveBeenCalled()
  })
})

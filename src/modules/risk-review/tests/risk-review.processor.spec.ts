import { Job } from "bullmq"

import { IRiskReviewJobData } from "../risk-review.interface"
import { RiskReviewProcessor } from "../risk-review.processor"
import { RiskReviewService } from "../risk-review.service"

describe("RiskReviewProcessor.onFailed", () => {
  const data: IRiskReviewJobData = { applicationId: "app-1", submissionVersion: 1 }
  let service: jest.Mocked<RiskReviewService>
  let processor: RiskReviewProcessor

  const failedJob = (attemptsMade: number) =>
    ({ id: "app-1-v1", data, attemptsMade, opts: { attempts: 3 } }) as unknown as Job<IRiskReviewJobData>

  beforeEach(() => {
    service = { markError: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<RiskReviewService>
    processor = new RiskReviewProcessor(service)
  })

  it("does not mark ERROR while retries remain", async () => {
    await processor.onFailed(failedJob(1), new Error("timeout"))
    await processor.onFailed(failedJob(2), new Error("timeout"))

    expect(service.markError).not.toHaveBeenCalled()
  })

  it("marks ERROR after the final attempt", async () => {
    await processor.onFailed(failedJob(3), new Error("timeout"))

    expect(service.markError).toHaveBeenCalledWith(data, "timeout")
  })
})

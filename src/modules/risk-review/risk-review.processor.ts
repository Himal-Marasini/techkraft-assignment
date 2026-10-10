import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Job } from "bullmq"
import { logger } from "src/utils"

import { RISK_REVIEW_QUEUE } from "./risk-review.constant"
import { IRiskReviewJobData } from "./risk-review.interface"
import { RiskReviewService } from "./risk-review.service"

@Processor(RISK_REVIEW_QUEUE)
export class RiskReviewProcessor extends WorkerHost {
  constructor(private readonly service: RiskReviewService) {
    super()
  }

  process(job: Job<IRiskReviewJobData>) {
    return this.service.processRiskCheck(job.data)
  }

  // Without a listener, Redis connection errors (e.g. a blip or shutdown) surface as unhandled errors.
  @OnWorkerEvent("error")
  onError(error: Error) {
    logger.error(`Risk review worker error: ${error.message}`)
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<IRiskReviewJobData> | undefined, error: Error) {
    if (!job) return

    const maxAttempts = job.opts.attempts ?? 1
    if (job.attemptsMade < maxAttempts) {
      logger.warn(`Risk review attempt ${job.attemptsMade}/${maxAttempts} failed for job ${job.id}, retrying`)
      return
    }

    try {
      await this.service.markError(job.data, error.message)
    } catch (markError) {
      logger.error(`Could not mark risk review as ERROR for job ${job.id}: ${(markError as Error).message}`)
    }
  }
}

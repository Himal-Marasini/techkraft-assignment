import { Injectable } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { logger } from "src/utils"

import { RiskReviewRepository } from "./risk-review.repository"
import { RiskReviewService } from "./risk-review.service"

@Injectable()
export class RiskReviewCron {
  constructor(
    private readonly repository: RiskReviewRepository,
    private readonly service: RiskReviewService
  ) {}

  // Picks up submissions whose job never reached Redis.
  @Cron(CronExpression.EVERY_MINUTE)
  async requeuePending() {
    try {
      const REQUEUE_AFTER_MS = 120_000
      const since = new Date(Date.now() - REQUEUE_AFTER_MS)
      const applications = await this.repository.findPendingSince(since)

      for (const application of applications) {
        await this.service.enqueue(application.id, application.submissionVersion)
      }
    } catch (error) {
      logger.error(`Risk review requeue failed: ${(error as Error).message}`)
    }
  }
}

import { BullModule } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"

import { AuditModule } from "../audit/audit.module"
import { RiskProviderService } from "./risk-provider.service"
import { RISK_REVIEW_JOB_OPTIONS, RISK_REVIEW_QUEUE } from "./risk-review.constant"
import { RiskReviewCron } from "./risk-review.cron"
import { RiskReviewProcessor } from "./risk-review.processor"
import { RiskReviewRepository } from "./risk-review.repository"
import { RiskReviewService } from "./risk-review.service"

@Module({
  imports: [
    BullModule.registerQueue({ name: RISK_REVIEW_QUEUE, defaultJobOptions: RISK_REVIEW_JOB_OPTIONS }),
    AuditModule
  ],
  providers: [RiskReviewService, RiskReviewRepository, RiskProviderService, RiskReviewProcessor, RiskReviewCron],
  exports: [RiskReviewService]
})
export class RiskReviewModule {}

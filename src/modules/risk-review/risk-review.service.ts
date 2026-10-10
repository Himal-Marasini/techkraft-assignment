import { InjectQueue } from "@nestjs/bullmq"
import { Injectable } from "@nestjs/common"
import { Queue } from "bullmq"
import { logger } from "src/utils"

import { AuditAction } from "../audit/audit.constant"
import { RiskLevel, RiskStatus } from "../merchant-applications/merchant-applications.constant"
import { RiskProviderService } from "./risk-provider.service"
import { RISK_REVIEW_JOB, RISK_REVIEW_QUEUE } from "./risk-review.constant"
import {
  ICompleteRiskReviewPayload,
  IRiskProviderInput,
  IRiskReviewErrorPayload,
  IRiskReviewJobData
} from "./risk-review.interface"
import { RiskReviewRepository } from "./risk-review.repository"

@Injectable()
export class RiskReviewService {
  constructor(
    @InjectQueue(RISK_REVIEW_QUEUE) private readonly queue: Queue<IRiskReviewJobData>,
    private readonly repository: RiskReviewRepository,
    private readonly provider: RiskProviderService
  ) {
    this.queue.on("error", (error) => logger.error(`Risk review queue error: ${error.message}`))
  }

  async enqueue(applicationId: string, submissionVersion: number) {
    await this.queue.add(
      RISK_REVIEW_JOB,
      { applicationId, submissionVersion },
      { jobId: `${applicationId}-v${submissionVersion}` }
    )
  }

  async processRiskCheck(job: IRiskReviewJobData) {
    const isProcessing = await this.repository.markProcessing(job)
    const application = isProcessing ? await this.repository.findApplication(job.applicationId) : null

    if (!application) {
      logger.info(
        `Risk review skipped for ${job.applicationId} v${job.submissionVersion}: already processed or superseded`
      )
      return false
    }

    const providerInput: IRiskProviderInput = {
      businessType: application.businessType,
      expectedMonthlyVolume: application.expectedMonthlyVolume,
      averageTicketSize: application.averageTicketSize
    }
    const result = await this.provider.assess(providerInput)
    const riskStatus = result.level === RiskLevel.HIGH ? RiskStatus.FAILED : RiskStatus.PASSED

    const completePayload: ICompleteRiskReviewPayload = {
      applicationId: job.applicationId,
      submissionVersion: job.submissionVersion,
      result,
      riskStatus,
      audit: {
        action: AuditAction.RISK_REVIEW_COMPLETED,
        actorId: null,
        metadata: {
          submissionVersion: job.submissionVersion,
          riskStatus,
          riskLevel: result.level,
          riskScore: result.score
        }
      }
    }

    const completed = await this.repository.completeRiskReview(completePayload)
    if (!completed) return false

    return true
  }

  /** Called once all retries are exhausted: riskStatus ERROR. */
  async markError(job: IRiskReviewJobData, reason: string) {
    const errorPayload: IRiskReviewErrorPayload = {
      applicationId: job.applicationId,
      submissionVersion: job.submissionVersion,
      audit: {
        action: AuditAction.RISK_REVIEW_ERROR,
        actorId: null,
        metadata: { submissionVersion: job.submissionVersion, reason }
      }
    }

    await this.repository.markRiskReviewError(errorPayload)
  }
}

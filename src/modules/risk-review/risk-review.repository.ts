import { Injectable } from "@nestjs/common"
import { DataSource, In, LessThan } from "typeorm"

import { IAuditEntry } from "../audit/audit.interface"
import { AuditRepository } from "../audit/audit.repository"
import { MerchantApplication } from "../merchant-applications/merchant-application.entity"
import {
  ApplicationStatus,
  RISK_IN_PROGRESS_STATUSES,
  RiskStatus
} from "../merchant-applications/merchant-applications.constant"
import { RiskAssessment } from "./risk-assessment.entity"
import { ICompleteRiskReviewPayload, IRiskReviewErrorPayload, IRiskReviewJobData } from "./risk-review.interface"

@Injectable()
export class RiskReviewRepository {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditRepository: AuditRepository
  ) {}

  findApplication(id: string) {
    return this.dataSource.getRepository(MerchantApplication).findOne({ where: { id } })
  }

  findPendingSince(date: Date) {
    return this.dataSource.getRepository(MerchantApplication).find({
      where: { status: ApplicationStatus.SUBMITTED, riskStatus: RiskStatus.PENDING, updatedAt: LessThan(date) }
    })
  }

  async markProcessing(payload: IRiskReviewJobData) {
    const where = {
      id: payload.applicationId,
      submissionVersion: payload.submissionVersion,
      riskStatus: In(RISK_IN_PROGRESS_STATUSES)
    }
    const { affected } = await this.dataSource
      .getRepository(MerchantApplication)
      .update(where, { riskStatus: RiskStatus.PROCESSING })

    return affected === 1
  }

  /**
   * One transaction: store the PASSED/FAILED result, move the application SUBMITTED -> UNDER_REVIEW,
   * insert the assessment and write the audit entry. The UPDATE only matches while this exact
   * submission's check is still in progress, so a concurrent duplicate job blocks on the row lock,
   * then matches 0 rows and writes nothing. Returns false when it was already handled.
   */
  completeRiskReview(payload: ICompleteRiskReviewPayload) {
    return this.dataSource.transaction(async (manager) => {
      const where = {
        id: payload.applicationId,
        submissionVersion: payload.submissionVersion,
        status: ApplicationStatus.SUBMITTED,
        riskStatus: In(RISK_IN_PROGRESS_STATUSES)
      }
      const changes = { riskStatus: payload.riskStatus, status: ApplicationStatus.UNDER_REVIEW }
      const { affected } = await manager.update(MerchantApplication, where, changes)
      if (affected !== 1) return false

      // Unique (application_id, submission_version) is the database-level.
      await manager.insert(RiskAssessment, {
        applicationId: payload.applicationId,
        submissionVersion: payload.submissionVersion,
        score: payload.result.score,
        level: payload.result.level
      })
      const auditEntry: IAuditEntry = { ...payload.audit, applicationId: payload.applicationId }
      await this.auditRepository.create(manager, auditEntry)

      return true
    })
  }

  markRiskReviewError(payload: IRiskReviewErrorPayload) {
    return this.dataSource.transaction(async (manager) => {
      const where = {
        id: payload.applicationId,
        submissionVersion: payload.submissionVersion,
        status: ApplicationStatus.SUBMITTED,
        riskStatus: In(RISK_IN_PROGRESS_STATUSES)
      }
      const changes = { riskStatus: RiskStatus.ERROR, status: ApplicationStatus.UNDER_REVIEW }
      const { affected } = await manager.update(MerchantApplication, where, changes)
      if (affected !== 1) return false

      const auditEntry: IAuditEntry = { ...payload.audit, applicationId: payload.applicationId }
      await this.auditRepository.create(manager, auditEntry)

      return true
    })
  }
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import { IAuthUser } from "src/common/interfaces"
import { logger } from "src/utils"

import { AuditAction } from "../audit/audit.constant"
import { RiskReviewService } from "../risk-review/risk-review.service"
import { Role } from "../users/users.constant"
import { UsersService } from "../users/users.service"
import {
  ApplicationStatus,
  ASSIGNABLE_STATUSES,
  EDITABLE_STATUSES,
  MERCHANT_APPLICATION_ERROR_MESSAGE as ERROR,
  RiskStatus,
  SUBMITTABLE_STATUSES
} from "./merchant-applications.constant"
import {
  AssignReviewerDTO,
  CreateMerchantApplicationDTO,
  ListMerchantApplicationsQueryDTO,
  RecordDecisionDTO,
  UpdateMerchantApplicationDTO
} from "./merchant-applications.dto"
import {
  ICreateMerchantApplicationPayload,
  IFindMerchantApplicationPayload,
  IMerchantApplicationListFilter,
  IMerchantApplicationScope,
  IUpdateMerchantApplicationPayload
} from "./merchant-applications.interface"
import { MerchantApplicationsRepository } from "./merchant-applications.repository"

@Injectable()
export class MerchantApplicationsService {
  constructor(
    private readonly repository: MerchantApplicationsRepository,
    private readonly usersService: UsersService,
    private readonly riskReviewService: RiskReviewService
  ) {}

  /** Data isolation by role: ADMIN sees everything, every other role only rows tied to their own id. */
  private getAccessFilter(user: IAuthUser) {
    const accessFilter: IMerchantApplicationScope = {}
    if (user.role === Role.SALES) accessFilter.createdById = user.id
    if (user.role === Role.REVIEWER) accessFilter.assignedReviewerId = user.id
    return accessFilter
  }

  /**
   * Loads the application within the caller's scope. Someone else's application gives the same
   * 404 as a missing one, so its existence isn't revealed.
   */
  private async findAccessibleById(user: IAuthUser, id: string) {
    const accessFilter = this.getAccessFilter(user)
    const payload: IFindMerchantApplicationPayload = { ...accessFilter, id }

    const record = await this.repository.findById(payload)
    if (!record) throw new NotFoundException(ERROR.NOT_FOUND)

    return record
  }

  async getMerchantApplications(user: IAuthUser, query: ListMerchantApplicationsQueryDTO) {
    const accessFilter = this.getAccessFilter(user)
    const filter: IMerchantApplicationListFilter = { ...accessFilter, status: query.status }

    const [records, totalCount] = await this.repository.findMany(filter, query.page, query.pageSize)
    return { records, totalCount }
  }

  async postMerchantApplication(user: IAuthUser, payload: CreateMerchantApplicationDTO) {
    const createPayload: ICreateMerchantApplicationPayload = {
      data: {
        ...payload,
        createdById: user.id,
        status: ApplicationStatus.DRAFT,
        riskStatus: null
      },
      audit: {
        action: AuditAction.APPLICATION_CREATED,
        actorId: user.id,
        metadata: { status: ApplicationStatus.DRAFT }
      }
    }

    return this.repository.createWithAudit(createPayload)
  }

  getMerchantApplication(user: IAuthUser, id: string) {
    return this.findAccessibleById(user, id)
  }

  async patchMerchantApplication(user: IAuthUser, id: string, payload: UpdateMerchantApplicationDTO) {
    const application = await this.findAccessibleById(user, id)
    if (!EDITABLE_STATUSES.includes(application.status)) throw new ConflictException(ERROR.NOT_EDITABLE)

    const changedFields = Object.keys(payload)
    if (!changedFields.length) return application

    const updatePayload: IUpdateMerchantApplicationPayload = {
      id,
      fromStatuses: EDITABLE_STATUSES,
      changes: payload,
      audit: {
        action: AuditAction.APPLICATION_UPDATED,
        actorId: user.id,
        metadata: { changedFields }
      }
    }

    const record = await this.repository.updateWithAudit(updatePayload)
    if (!record) throw new ConflictException(ERROR.CONCURRENT_UPDATE)
    return record
  }

  async postAssignReviewer(user: IAuthUser, id: string, payload: AssignReviewerDTO) {
    const application = await this.findAccessibleById(user, id)
    if (!ASSIGNABLE_STATUSES.includes(application.status)) throw new ConflictException(ERROR.NOT_ASSIGNABLE)

    const reviewer = await this.usersService.findById(payload.reviewerId)
    if (!reviewer || reviewer.role !== Role.REVIEWER) throw new BadRequestException(ERROR.INVALID_REVIEWER)

    const assignPayload: IUpdateMerchantApplicationPayload = {
      id,
      fromStatuses: ASSIGNABLE_STATUSES,
      changes: { assignedReviewerId: reviewer.id },
      audit: {
        action: AuditAction.REVIEWER_ASSIGNED,
        actorId: user.id,
        metadata: { reviewerId: reviewer.id, previousReviewerId: application.assignedReviewerId }
      }
    }

    const assigned = await this.repository.updateWithAudit(assignPayload)
    if (!assigned) throw new ConflictException(ERROR.CONCURRENT_UPDATE)

    return assigned
  }

  async postSubmitMerchantApplication(user: IAuthUser, id: string) {
    const record = await this.findAccessibleById(user, id)
    if (!SUBMITTABLE_STATUSES.includes(record.status)) throw new ConflictException(ERROR.NOT_SUBMITTABLE)

    const submissionVersion = record.submissionVersion + 1
    const nextStatus = ApplicationStatus.SUBMITTED

    const submitPayload: IUpdateMerchantApplicationPayload = {
      id,
      fromStatuses: SUBMITTABLE_STATUSES,
      changes: { status: nextStatus, riskStatus: RiskStatus.PENDING, submissionVersion },
      // Also guards against two concurrent submits both reading the same version.
      conditions: { submissionVersion: record.submissionVersion },
      audit: {
        action: AuditAction.APPLICATION_SUBMITTED,
        actorId: user.id,
        metadata: { submissionVersion, fromStatus: record.status, toStatus: nextStatus }
      }
    }

    const submitted = await this.repository.updateWithAudit(submitPayload)
    if (!submitted) throw new ConflictException(ERROR.CONCURRENT_UPDATE)

    this.riskReviewService
      .enqueue(id, submissionVersion)
      .catch((error: Error) => logger.error(`Could not queue risk review for ${id}: ${error.message}`))

    return submitted
  }

  async postRecordDecision(user: IAuthUser, id: string, payload: RecordDecisionDTO) {
    const application = await this.findAccessibleById(user, id)
    if (application.status !== ApplicationStatus.UNDER_REVIEW) throw new ConflictException(ERROR.NOT_UNDER_REVIEW)

    const isApproval = payload.decision === ApplicationStatus.APPROVED

    if (isApproval && application.riskStatus !== RiskStatus.PASSED) {
      throw new ConflictException(ERROR.RISK_NOT_PASSED)
    }

    const decisionPayload: IUpdateMerchantApplicationPayload = {
      id,
      fromStatuses: [ApplicationStatus.UNDER_REVIEW],
      changes: { status: payload.decision, reviewNote: payload.reason },
      conditions: {
        assignedReviewerId: user.id,
        ...(isApproval && { riskStatus: RiskStatus.PASSED })
      },
      audit: {
        action: AuditAction.DECISION_RECORDED,
        actorId: user.id,
        metadata: {
          fromStatus: application.status,
          toStatus: payload.decision,
          reason: payload.reason
        }
      }
    }

    const decided = await this.repository.updateWithAudit(decisionPayload)
    if (!decided) throw new ConflictException(ERROR.CONCURRENT_UPDATE)

    return decided
  }
}

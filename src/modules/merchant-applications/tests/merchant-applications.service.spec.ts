import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common"
import { IAuthUser } from "src/common/interfaces"

import { AuditAction } from "../../audit/audit.constant"
import { RiskReviewService } from "../../risk-review/risk-review.service"
import { User } from "../../users/user.entity"
import { Role } from "../../users/users.constant"
import { UsersService } from "../../users/users.service"
import { MerchantApplication } from "../merchant-application.entity"
import { ApplicationStatus, BusinessType, RiskStatus } from "../merchant-applications.constant"
import { CreateMerchantApplicationDTO, RecordDecisionDTO } from "../merchant-applications.dto"
import { IUpdateMerchantApplicationPayload } from "../merchant-applications.interface"
import { MerchantApplicationsRepository } from "../merchant-applications.repository"
import { MerchantApplicationsService } from "../merchant-applications.service"

const admin: IAuthUser = { id: "admin-1", email: "admin@techkraft.test", role: Role.ADMIN }
const sales: IAuthUser = { id: "sales-1", email: "sales1@techkraft.test", role: Role.SALES }
const reviewer: IAuthUser = { id: "reviewer-1", email: "reviewer1@techkraft.test", role: Role.REVIEWER }

const APPLICATION_ID = "app-1"

function application(overrides: Partial<MerchantApplication> = {}) {
  return Object.assign(new MerchantApplication(), {
    id: APPLICATION_ID,
    createdById: sales.id,
    assignedReviewerId: null,
    status: ApplicationStatus.DRAFT,
    riskStatus: null,
    submissionVersion: 0,
    ...overrides
  })
}

function decision(status: ApplicationStatus, reason: string | null = null) {
  return Object.assign(new RecordDecisionDTO(), { decision: status, reason })
}

describe("MerchantApplicationsService", () => {
  let repository: jest.Mocked<MerchantApplicationsRepository>
  let usersService: jest.Mocked<UsersService>
  let riskReviewService: jest.Mocked<RiskReviewService>
  let service: MerchantApplicationsService

  // The repository mock returns the stored application with the requested changes applied.
  const stored = (record: MerchantApplication) => {
    repository.findById.mockResolvedValue(record)
    repository.updateWithAudit.mockImplementation(async (payload: IUpdateMerchantApplicationPayload) =>
      Object.assign(new MerchantApplication(), record, payload.changes)
    )
  }

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findMany: jest.fn().mockResolvedValue([[], 0]),
      createWithAudit: jest.fn(),
      updateWithAudit: jest.fn()
    } as unknown as jest.Mocked<MerchantApplicationsRepository>
    usersService = { findById: jest.fn() } as unknown as jest.Mocked<UsersService>
    riskReviewService = { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<RiskReviewService>

    service = new MerchantApplicationsService(repository, usersService, riskReviewService)
  })

  describe("object-level access", () => {
    it("does not filter by user for ADMIN", async () => {
      stored(application())

      await service.getMerchantApplication(admin, APPLICATION_ID)

      expect(repository.findById).toHaveBeenCalledWith({ id: APPLICATION_ID })
    })

    it("limits SALES to applications they created", async () => {
      stored(application())

      await service.getMerchantApplication(sales, APPLICATION_ID)

      expect(repository.findById).toHaveBeenCalledWith({ id: APPLICATION_ID, createdById: sales.id })
    })

    it("limits REVIEWER to applications assigned to them", async () => {
      stored(application({ assignedReviewerId: reviewer.id }))

      await service.getMerchantApplication(reviewer, APPLICATION_ID)

      expect(repository.findById).toHaveBeenCalledWith({ id: APPLICATION_ID, assignedReviewerId: reviewer.id })
    })

    it("answers 404 when the application is missing or outside the caller's scope", async () => {
      repository.findById.mockResolvedValue(null)

      await expect(service.getMerchantApplication(sales, APPLICATION_ID)).rejects.toThrow(NotFoundException)
    })

    it.each([
      ["ADMIN", admin, {}],
      ["SALES", sales, { createdById: sales.id }],
      ["REVIEWER", reviewer, { assignedReviewerId: reviewer.id }]
    ])("applies the same scope to the list for %s, together with the status filter", async (_role, user, scope) => {
      await service.getMerchantApplications(user, { page: 2, pageSize: 10, status: ApplicationStatus.DRAFT })

      expect(repository.findMany).toHaveBeenCalledWith({ ...scope, status: ApplicationStatus.DRAFT }, 2, 10)
    })
  })

  describe("create", () => {
    it("creates a DRAFT owned by the caller with no risk status and an audit entry", async () => {
      const payload: CreateMerchantApplicationDTO = {
        businessName: "Everest Coffee House",
        legalBusinessName: "Everest Coffee House Pvt. Ltd.",
        businessType: BusinessType.PARTNERSHIP,
        taxId: "00-1234567",
        ownerFullName: "Jane Example",
        ownerEmail: "jane.owner@example.com",
        expectedMonthlyVolume: 50_000,
        averageTicketSize: 45.5
      }

      await service.postMerchantApplication(sales, payload)

      expect(repository.createWithAudit).toHaveBeenCalledWith({
        data: { ...payload, createdById: sales.id, status: ApplicationStatus.DRAFT, riskStatus: null },
        audit: expect.objectContaining({ action: AuditAction.APPLICATION_CREATED, actorId: sales.id })
      })
    })
  })

  describe("update", () => {
    it.each([ApplicationStatus.DRAFT, ApplicationStatus.INFO_REQUESTED])("is allowed in %s", async (status) => {
      stored(application({ status }))

      const updated = await service.patchMerchantApplication(sales, APPLICATION_ID, { businessName: "New Name" })

      expect(updated.businessName).toBe("New Name")
    })

    it.each([
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.UNDER_REVIEW,
      ApplicationStatus.APPROVED,
      ApplicationStatus.REJECTED
    ])("is rejected with 409 in %s", async (status) => {
      stored(application({ status }))

      await expect(
        service.patchMerchantApplication(sales, APPLICATION_ID, { businessName: "New Name" })
      ).rejects.toThrow(ConflictException)
      expect(repository.updateWithAudit).not.toHaveBeenCalled()
    })

    it("audits the changed field names only, never their values", async () => {
      stored(application())

      await service.patchMerchantApplication(sales, APPLICATION_ID, { ownerEmail: "new.owner@example.com" })

      const payload = repository.updateWithAudit.mock.calls[0][0]
      expect(payload.audit).toEqual({
        action: AuditAction.APPLICATION_UPDATED,
        actorId: sales.id,
        metadata: { changedFields: ["ownerEmail"] }
      })
    })

    it("does nothing for an empty body", async () => {
      const record = application()
      stored(record)

      await expect(service.patchMerchantApplication(sales, APPLICATION_ID, {})).resolves.toBe(record)
      expect(repository.updateWithAudit).not.toHaveBeenCalled()
    })

    it("answers 409 when the application changed between the check and the write", async () => {
      stored(application())
      repository.updateWithAudit.mockResolvedValue(null)

      await expect(
        service.patchMerchantApplication(sales, APPLICATION_ID, { businessName: "New Name" })
      ).rejects.toThrow(ConflictException)
    })
  })

  describe("submit", () => {
    it.each([ApplicationStatus.DRAFT, ApplicationStatus.INFO_REQUESTED])(
      "moves %s to SUBMITTED with a PENDING risk check and queues the job",
      async (status) => {
        stored(application({ status, submissionVersion: 1 }))

        const submitted = await service.postSubmitMerchantApplication(sales, APPLICATION_ID)

        expect(submitted).toMatchObject({
          status: ApplicationStatus.SUBMITTED,
          riskStatus: RiskStatus.PENDING,
          submissionVersion: 2
        })
        expect(repository.updateWithAudit).toHaveBeenCalledWith(
          expect.objectContaining({ conditions: { submissionVersion: 1 } })
        )
        expect(riskReviewService.enqueue).toHaveBeenCalledWith(APPLICATION_ID, 2)
      }
    )

    it.each([
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.UNDER_REVIEW,
      ApplicationStatus.APPROVED,
      ApplicationStatus.REJECTED
    ])("is rejected with 409 in %s and queues nothing", async (status) => {
      stored(application({ status }))

      await expect(service.postSubmitMerchantApplication(sales, APPLICATION_ID)).rejects.toThrow(ConflictException)
      expect(riskReviewService.enqueue).not.toHaveBeenCalled()
    })

    it("queues nothing when a concurrent submit won", async () => {
      stored(application())
      repository.updateWithAudit.mockResolvedValue(null)

      await expect(service.postSubmitMerchantApplication(sales, APPLICATION_ID)).rejects.toThrow(ConflictException)
      expect(riskReviewService.enqueue).not.toHaveBeenCalled()
    })
  })

  describe("assign reviewer", () => {
    const reviewerUser = Object.assign(new User(), { id: reviewer.id, role: Role.REVIEWER })

    it.each([ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW])(
      "is allowed in %s and does not change the status",
      async (status) => {
        stored(application({ status }))
        usersService.findById.mockResolvedValue(reviewerUser)

        const assigned = await service.postAssignReviewer(admin, APPLICATION_ID, { reviewerId: reviewer.id })

        expect(assigned).toMatchObject({ status, assignedReviewerId: reviewer.id })
        expect(repository.updateWithAudit.mock.calls[0][0].changes).toEqual({ assignedReviewerId: reviewer.id })
      }
    )

    it.each([
      ApplicationStatus.DRAFT,
      ApplicationStatus.INFO_REQUESTED,
      ApplicationStatus.APPROVED,
      ApplicationStatus.REJECTED
    ])("is rejected with 409 in %s", async (status) => {
      stored(application({ status }))

      await expect(service.postAssignReviewer(admin, APPLICATION_ID, { reviewerId: reviewer.id })).rejects.toThrow(
        ConflictException
      )
    })

    it.each([
      ["does not exist", null],
      ["is not a REVIEWER", Object.assign(new User(), { id: sales.id, role: Role.SALES })]
    ])("is rejected with 400 when the user %s", async (_case, user) => {
      stored(application({ status: ApplicationStatus.UNDER_REVIEW }))
      usersService.findById.mockResolvedValue(user)

      await expect(service.postAssignReviewer(admin, APPLICATION_ID, { reviewerId: "someone" })).rejects.toThrow(
        BadRequestException
      )
      expect(repository.updateWithAudit).not.toHaveBeenCalled()
    })
  })

  describe("review decision", () => {
    const underReview = (riskStatus: RiskStatus) =>
      application({ status: ApplicationStatus.UNDER_REVIEW, assignedReviewerId: reviewer.id, riskStatus })

    it("approves when the risk check PASSED, re-checking reviewer and risk status in the update", async () => {
      stored(underReview(RiskStatus.PASSED))

      const decided = await service.postRecordDecision(reviewer, APPLICATION_ID, decision(ApplicationStatus.APPROVED))

      expect(decided.status).toBe(ApplicationStatus.APPROVED)
      expect(repository.updateWithAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatuses: [ApplicationStatus.UNDER_REVIEW],
          conditions: { assignedReviewerId: reviewer.id, riskStatus: RiskStatus.PASSED },
          audit: expect.objectContaining({ action: AuditAction.DECISION_RECORDED, actorId: reviewer.id })
        })
      )
    })

    it.each([RiskStatus.FAILED, RiskStatus.ERROR])("cannot approve when the risk check is %s", async (riskStatus) => {
      stored(underReview(riskStatus))

      await expect(
        service.postRecordDecision(reviewer, APPLICATION_ID, decision(ApplicationStatus.APPROVED))
      ).rejects.toThrow(ConflictException)
      expect(repository.updateWithAudit).not.toHaveBeenCalled()
    })

    it.each([
      [ApplicationStatus.REJECTED, RiskStatus.FAILED],
      [ApplicationStatus.REJECTED, RiskStatus.ERROR],
      [ApplicationStatus.INFO_REQUESTED, RiskStatus.FAILED],
      [ApplicationStatus.INFO_REQUESTED, RiskStatus.PASSED]
    ])("allows %s when the risk check is %s and stores the reason", async (status, riskStatus) => {
      stored(underReview(riskStatus))

      const decided = await service.postRecordDecision(reviewer, APPLICATION_ID, decision(status, "Need more detail"))

      expect(decided).toMatchObject({ status, reviewNote: "Need more detail" })
      expect(repository.updateWithAudit.mock.calls[0][0].conditions).toEqual({ assignedReviewerId: reviewer.id })
    })

    it.each([
      ApplicationStatus.DRAFT,
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.INFO_REQUESTED,
      ApplicationStatus.APPROVED,
      ApplicationStatus.REJECTED
    ])("is rejected with 409 while the application is %s", async (status) => {
      stored(application({ status, assignedReviewerId: reviewer.id, riskStatus: RiskStatus.PASSED }))

      await expect(
        service.postRecordDecision(reviewer, APPLICATION_ID, decision(ApplicationStatus.REJECTED, "No"))
      ).rejects.toThrow(ConflictException)
      expect(repository.updateWithAudit).not.toHaveBeenCalled()
    })

    it("answers 409 when the application was re-assigned or decided concurrently", async () => {
      stored(underReview(RiskStatus.PASSED))
      repository.updateWithAudit.mockResolvedValue(null)

      await expect(
        service.postRecordDecision(reviewer, APPLICATION_ID, decision(ApplicationStatus.APPROVED))
      ).rejects.toThrow(ConflictException)
    })
  })
})

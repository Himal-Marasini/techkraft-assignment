import { ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger"

const APPLICATION_EXAMPLE = {
  id: "3f0c2a52-8a1d-4a5b-9a52-6f1e2d3c4b5a",
  createdAt: "2026-10-09T05:00:00.000Z",
  updatedAt: "2026-10-09T05:00:00.000Z",
  businessName: "Everest Coffee House",
  legalBusinessName: "Everest Coffee House Pvt. Ltd.",
  businessType: "PARTNERSHIP",
  ownerFullName: "Jane Example",
  ownerEmail: "jane.owner@example.com",
  expectedMonthlyVolume: 50000,
  averageTicketSize: 45.5,
  status: "DRAFT",
  riskStatus: null,
  submissionVersion: 0,
  reviewNote: null,
  createdById: "0b8f3c1e-6a3b-4f7e-9d2a-1c5e8f7a9b10",
  assignedReviewerId: null,
  taxIdMasked: "******0000"
}

const idParam = ApiParam({ name: "id", description: "Merchant application id (UUID)" })

const errors = {
  badRequest: ApiResponse({
    status: 400,
    description: "Validation failed.",
    schema: { example: { success: false, message: "Validation failed", details: ["property status should not exist"] } }
  }),
  unauthorized: ApiResponse({
    status: 401,
    description: "Missing, invalid or expired token.",
    schema: { example: { success: false, message: "Invalid or expired access token" } }
  }),
  forbidden: ApiResponse({
    status: 403,
    description: "Role not allowed for this action.",
    schema: { example: { success: false, message: "You do not have permission to perform this action" } }
  }),
  notFound: ApiResponse({
    status: 404,
    description: "Not found — also returned for an application outside the caller's scope (SALES: not theirs, REVIEWER: not assigned).",
    schema: { example: { success: false, message: "Merchant application not found" } }
  }),
  conflict: ApiResponse({
    status: 409,
    description: "Invalid state transition.",
    schema: {
      example: { success: false, message: "Application can only be edited while in DRAFT or INFO_REQUESTED status" }
    }
  })
}

const success = (status: number, message: string, data: unknown) =>
  ApiResponse({ status, description: message, schema: { example: { success: true, message, data } } })

export const postMerchantApplicationDocs = {
  operation: ApiOperation({
    summary: "Create merchant application",
    description: "SALES, ADMIN. Creates a DRAFT application owned by the caller."
  }),
  responses: {
    success: success(201, "Merchant application created successfully", APPLICATION_EXAMPLE),
    ...errors
  }
}

export const getMerchantApplicationsDocs = {
  operation: ApiOperation({
    summary: "List merchant applications",
    description:
      "All roles. Paginated, newest first, optional status filter. ADMIN sees all; SALES only applications they created; REVIEWER only applications assigned to them."
  }),
  responses: {
    success: ApiResponse({
      status: 200,
      description: "Merchant applications fetched successfully",
      schema: {
        example: {
          success: true,
          message: "Merchant applications fetched successfully",
          data: [APPLICATION_EXAMPLE],
          totalCount: 1
        }
      }
    }),
    ...errors
  }
}

export const getMerchantApplicationDocs = {
  operation: ApiOperation({
    summary: "Get merchant application",
    description: "All roles. 404 when outside the caller's scope: SALES for applications they did not create, REVIEWER for applications not assigned to them."
  }),
  param: idParam,
  responses: {
    success: success(200, "Merchant application fetched successfully", APPLICATION_EXAMPLE),
    ...errors
  }
}

export const patchMerchantApplicationDocs = {
  operation: ApiOperation({
    summary: "Update merchant application",
    description: "SALES (own only), ADMIN. Only while the application is DRAFT or INFO_REQUESTED; otherwise 409."
  }),
  param: idParam,
  responses: {
    success: success(200, "Merchant application updated successfully", APPLICATION_EXAMPLE),
    ...errors
  }
}

export const postSubmitMerchantApplicationDocs = {
  operation: ApiOperation({
    summary: "Submit for review",
    description:
      "SALES (own only), ADMIN. From DRAFT or INFO_REQUESTED. Sets status=SUBMITTED, riskStatus=PENDING and queues an " +
      "asynchronous risk/KYB check (PENDING → PROCESSING → PASSED / FAILED / ERROR). When the check ends the " +
      "application moves to UNDER_REVIEW; poll GET /merchant-applications/{id}. Resubmitting after INFO_REQUESTED " +
      "keeps the assigned reviewer, so it goes straight back to them."
  }),
  param: idParam,
  responses: {
    success: success(202, "Merchant application submitted. Risk review has been queued", {
      ...APPLICATION_EXAMPLE,
      status: "SUBMITTED",
      riskStatus: "PENDING",
      submissionVersion: 1
    }),
    ...errors
  }
}

export const postAssignReviewerDocs = {
  operation: ApiOperation({
    summary: "Assign reviewer",
    description:
      "ADMIN only. Application must be SUBMITTED (risk check still running) or UNDER_REVIEW; re-assignment is " +
      "allowed until a decision. Assigning does not change the status."
  }),
  param: idParam,
  responses: {
    success: success(200, "Reviewer assigned successfully", {
      ...APPLICATION_EXAMPLE,
      status: "UNDER_REVIEW",
      riskStatus: "PASSED",
      assignedReviewerId: "7c9e6679-7425-40de-944b-e07fc1f90ae7"
    }),
    ...errors
  }
}

export const postRecordDecisionDocs = {
  operation: ApiOperation({
    summary: "Record review decision",
    description:
      "Only the assigned REVIEWER (any other reviewer gets 404). Application must be UNDER_REVIEW. `decision` is the " +
      "new status: APPROVED, REJECTED or INFO_REQUESTED. APPROVED also requires riskStatus=PASSED; REJECTED and " +
      "INFO_REQUESTED are allowed whatever the risk outcome and need a reason. " +
      "After INFO_REQUESTED the application is editable again by SALES."
  }),
  param: idParam,
  responses: {
    success: success(200, "Review decision recorded successfully", {
      ...APPLICATION_EXAMPLE,
      status: "APPROVED",
      riskStatus: "PASSED",
      assignedReviewerId: "7c9e6679-7425-40de-944b-e07fc1f90ae7"
    }),
    ...errors
  }
}

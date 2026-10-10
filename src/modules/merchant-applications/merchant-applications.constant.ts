export enum ApplicationStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  UNDER_REVIEW = "UNDER_REVIEW",

  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  INFO_REQUESTED = "INFO_REQUESTED"
}

// Outcome of the automated (BullMQ) risk/KYB check — not the reviewer's decision. NULL until submitted.
export enum RiskStatus {
  PENDING = "PENDING", // queued
  PROCESSING = "PROCESSING", // worker picked it up
  PASSED = "PASSED", // check done, risk acceptable
  FAILED = "FAILED", // check done, risk too high
  ERROR = "ERROR" // provider kept failing; retries exhausted
}

export enum RiskLevel {
  LOW = "LOW",
  HIGH = "HIGH"
}

export enum BusinessType {
  SOLE_PROPRIETOR = "SOLE_PROPRIETOR",
  PARTNERSHIP = "PARTNERSHIP"
}

// Statuses each action may start from; the repository re-checks them in the UPDATE's WHERE clause.
export const EDITABLE_STATUSES = [ApplicationStatus.DRAFT, ApplicationStatus.INFO_REQUESTED]
export const SUBMITTABLE_STATUSES = [ApplicationStatus.DRAFT, ApplicationStatus.INFO_REQUESTED]
// A reviewer can be assigned while the risk check is still running (SUBMITTED) or after it (UNDER_REVIEW);
// re-assignment is allowed until a decision. Assigning never changes the status.
export const ASSIGNABLE_STATUSES = [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW]
// Risk check still running; a retry finds the job in PROCESSING from its previous attempt.
export const RISK_IN_PROGRESS_STATUSES = [RiskStatus.PENDING, RiskStatus.PROCESSING]
export const REVIEW_DECISION_STATUSES = [
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.INFO_REQUESTED
]

export const MERCHANT_APPLICATION_SUCCESS_MESSAGE = {
  CREATED: "Merchant application created successfully",
  UPDATED: "Merchant application updated successfully",
  FETCHED: "Merchant application fetched successfully",
  FETCHED_LIST: "Merchant applications fetched successfully",
  SUBMITTED: "Merchant application submitted. Risk review has been queued",
  ASSIGNED: "Reviewer assigned successfully",
  DECISION_RECORDED: "Review decision recorded successfully"
}

export const MERCHANT_APPLICATION_ERROR_MESSAGE = {
  NOT_FOUND: "Merchant application not found",
  NOT_EDITABLE: "Application can only be edited while in DRAFT or INFO_REQUESTED status",
  NOT_SUBMITTABLE: "Application can only be submitted from DRAFT or INFO_REQUESTED status",
  NOT_ASSIGNABLE: "A reviewer can only be assigned while the application is SUBMITTED or UNDER_REVIEW",
  NOT_UNDER_REVIEW: "A decision can only be recorded while the application is UNDER_REVIEW",
  RISK_NOT_PASSED: "Application can only be approved when the risk check has PASSED",
  INVALID_REVIEWER: "reviewerId must belong to a user with the REVIEWER role",
  CONCURRENT_UPDATE: "The application was changed by another request. Please reload and try again"
}

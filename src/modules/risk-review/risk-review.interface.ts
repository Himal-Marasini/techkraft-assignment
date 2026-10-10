import { IApplicationAuditEntry } from "../audit/audit.interface"
import { BusinessType, RiskLevel, RiskStatus } from "../merchant-applications/merchant-applications.constant"

export interface IRiskReviewJobData {
  applicationId: string
  submissionVersion: number
}

/** Only non-PII fields are sent to the (simulated) provider. */
export interface IRiskProviderInput {
  businessType: BusinessType
  expectedMonthlyVolume: number
  averageTicketSize: number
}

interface IRiskProviderResult {
  score: number
  level: RiskLevel
  checks: Record<string, string>
}

export interface ICompleteRiskReviewPayload {
  applicationId: string
  submissionVersion: number
  result: IRiskProviderResult
  // PASSED or FAILED, derived from the result's risk level.
  riskStatus: RiskStatus
  audit: IApplicationAuditEntry
}

export interface IRiskReviewErrorPayload {
  applicationId: string
  submissionVersion: number
  audit: IApplicationAuditEntry
}

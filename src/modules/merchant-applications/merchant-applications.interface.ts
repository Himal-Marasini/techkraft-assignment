import { DeepPartial, FindOptionsWhere } from "typeorm"

import { IApplicationAuditEntry } from "../audit/audit.interface"
import { MerchantApplication } from "./merchant-application.entity"
import { ApplicationStatus } from "./merchant-applications.constant"

// Role-based row scope: empty for ADMIN, createdById for SALES, assignedReviewerId for REVIEWER.
export interface IMerchantApplicationScope {
  createdById?: string
  assignedReviewerId?: string
}

export interface IMerchantApplicationListFilter extends IMerchantApplicationScope {
  status?: ApplicationStatus
}

export interface IFindMerchantApplicationPayload extends IMerchantApplicationScope {
  id: string
}

export interface ICreateMerchantApplicationPayload {
  data: DeepPartial<MerchantApplication>
  audit: IApplicationAuditEntry
}

export interface IUpdateMerchantApplicationPayload {
  id: string
  // The update only applies while the application is still in one of these statuses.
  fromStatuses: ApplicationStatus[]
  changes: Partial<MerchantApplication>
  // Extra conditions re-checked in the same UPDATE (e.g. still assigned to this reviewer).
  conditions?: FindOptionsWhere<MerchantApplication>
  audit: IApplicationAuditEntry
}

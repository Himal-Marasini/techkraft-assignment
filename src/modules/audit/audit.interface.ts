import { AuditAction } from "./audit.constant"

export interface IAuditEntry {
  action: AuditAction
  applicationId: string
  actorId: string | null
  metadata?: Record<string, unknown>
}

export type IApplicationAuditEntry = Omit<IAuditEntry, "applicationId">

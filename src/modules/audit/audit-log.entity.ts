import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm"

import { AuditAction } from "./audit.constant"

/**
 * Append-only record of significant actions. No updated_at and no update/delete code paths.
 * actor_id / application_id have no foreign keys on purpose: audit history must outlive the rows it describes.
 */
@Entity("audit_logs")
@Index(["applicationId", "createdAt"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "enum", enum: AuditAction, enumName: "audit_action" })
  action: AuditAction

  @Column({ type: "uuid" })
  applicationId: string

  // NULL when the action was performed by the system (e.g. the risk-review worker).
  @Column({ type: "uuid", nullable: true })
  actorId: string | null

  // Already redacted; holds ids, field names and decisions, never raw PII or secrets.
  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, unknown>

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date
}

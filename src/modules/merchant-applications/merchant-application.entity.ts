import { Exclude, Expose } from "class-transformer"
import { Column, Entity, Index, JoinColumn, ManyToOne, ValueTransformer } from "typeorm"

import { AbstractEntity } from "../../typeorm/entities/base.entity"
import { User } from "../users/user.entity"
import { ApplicationStatus, BusinessType, RiskStatus } from "./merchant-applications.constant"

// pg returns NUMERIC as a string to avoid precision loss; amounts here (<= 12 integer digits,
// 2 decimals) are exactly representable as JS numbers, so convert for a friendlier API.
const numericToNumber: ValueTransformer = {
  to: (value?: number) => value,
  from: (value?: string | null) => (value === null || value === undefined ? value : Number(value))
}

@Entity("merchant_applications")
// Match the list queries: SALES see their own (created_by_id), everyone can filter by status; newest first.
@Index(["createdById", "createdAt"])
@Index(["status", "createdAt"])
export class MerchantApplication extends AbstractEntity {
  // --- Business ---
  @Column({ length: 200 })
  businessName: string

  @Column({ length: 200 })
  legalBusinessName: string

  @Column({ type: "enum", enum: BusinessType, enumName: "business_type" })
  businessType: BusinessType

  // --- Owner / contact  ---
  @Column({ length: 150 })
  ownerFullName: string

  @Column({ length: 254 })
  ownerEmail: string

  // --- Requested processing (amounts in the platform's single currency) ---
  @Column({ type: "numeric", precision: 14, scale: 2, transformer: numericToNumber })
  expectedMonthlyVolume: number

  @Column({ type: "numeric", precision: 14, scale: 2, transformer: numericToNumber })
  averageTicketSize: number

  // --- Workflow ---
  @Column({ type: "enum", enum: ApplicationStatus, enumName: "application_status", default: ApplicationStatus.DRAFT })
  status: ApplicationStatus

  // NULL until the application is first submitted.
  @Column({ type: "enum", enum: RiskStatus, enumName: "risk_status", nullable: true })
  riskStatus: RiskStatus | null

  // Sensitive: never returned in full (see taxIdMasked). Candidate for field-level encryption.
  @Exclude()
  @Column({ length: 32 })
  taxId: string

  // Incremented on every submit. Risk jobs carry the version they were queued for, so a late or
  // duplicate job for an older submission is ignored (idempotency).
  @Column({ type: "int", default: 0 })
  submissionVersion: number

  // Reviewer's note on the latest decision (e.g. what information is missing).
  @Column({ type: "text", nullable: true })
  reviewNote: string | null

  // --- Ownership ---
  @Column({ type: "uuid" })
  createdById: string

  @ManyToOne(() => User, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_id" })
  createdBy?: User

  @Index()
  @Column({ type: "uuid", nullable: true })
  assignedReviewerId: string | null

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: true })
  @JoinColumn({ name: "assigned_reviewer_id" })
  assignedReviewer?: User | null

  @Expose()
  get taxIdMasked() {
    if (!this.taxId) return undefined
    const hiddenLength = Math.max(this.taxId.length - 4, 0)
    const lastFour = this.taxId.slice(-4)
    return `${"*".repeat(hiddenLength)}${lastFour}`
  }
}

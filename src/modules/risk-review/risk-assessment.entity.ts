import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm"

import { AbstractEntity } from "../../typeorm/entities/base.entity"
import { MerchantApplication } from "../merchant-applications/merchant-application.entity"
import { RiskLevel } from "../merchant-applications/merchant-applications.constant"

/** Result of one risk/KYB check. At most one per (application, submission) — enforced by the DB. */
@Entity("risk_assessments")
@Unique("uq_risk_assessment_submission", ["applicationId", "submissionVersion"])
export class RiskAssessment extends AbstractEntity {
  @Column({ type: "uuid" })
  applicationId: string

  @ManyToOne(() => MerchantApplication, { onDelete: "CASCADE" })
  @JoinColumn({ name: "application_id" })
  application?: MerchantApplication

  @Column({ type: "int" })
  submissionVersion: number

  @Column({ type: "int" })
  score: number

  @Column({ type: "enum", enum: RiskLevel, enumName: "risk_level" })
  level: RiskLevel
}

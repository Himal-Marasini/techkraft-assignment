import { MigrationInterface, QueryRunner } from "typeorm"

/** Generated with `pnpm migration:generate`, then reviewed by hand. */
export class InitialSchema1791523940232 implements MigrationInterface {
  name = "InitialSchema1791523940232"

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'REVIEWER', 'SALES')`)
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(254) NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."user_role" NOT NULL, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."business_type" AS ENUM('SOLE_PROPRIETOR', 'PARTNERSHIP')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."application_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'INFO_REQUESTED')`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."risk_status" AS ENUM('PENDING', 'PROCESSING', 'PASSED', 'FAILED', 'ERROR')`
    )
    await queryRunner.query(`CREATE TYPE "public"."risk_level" AS ENUM('LOW', 'HIGH')`)
    await queryRunner.query(
      `CREATE TABLE "merchant_applications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "business_name" character varying(200) NOT NULL, "legal_business_name" character varying(200) NOT NULL, "business_type" "public"."business_type" NOT NULL, "owner_full_name" character varying(150) NOT NULL, "owner_email" character varying(254) NOT NULL, "expected_monthly_volume" numeric(14,2) NOT NULL, "average_ticket_size" numeric(14,2) NOT NULL, "status" "public"."application_status" NOT NULL DEFAULT 'DRAFT', "risk_status" "public"."risk_status", "tax_id" character varying(32) NOT NULL, "submission_version" integer NOT NULL DEFAULT '0', "review_note" text, "created_by_id" uuid NOT NULL, "assigned_reviewer_id" uuid, CONSTRAINT "PK_09b9df0877db73b8a232c8c7ed4" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_7da78a3bb9e76995dba067b83e" ON "merchant_applications" ("assigned_reviewer_id") `
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_e2e91e10700d9e012684742675" ON "merchant_applications" ("status", "created_at") `
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_820ded4c4c9f905c036c10866a" ON "merchant_applications" ("created_by_id", "created_at") `
    )
    await queryRunner.query(
      `CREATE TABLE "risk_assessments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "application_id" uuid NOT NULL, "submission_version" integer NOT NULL, "score" integer NOT NULL, "level" "public"."risk_level" NOT NULL, CONSTRAINT "uq_risk_assessment_submission" UNIQUE ("application_id", "submission_version"), CONSTRAINT "PK_2717ff3f294d30390a712653d63" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE TYPE "public"."audit_action" AS ENUM('APPLICATION_CREATED', 'APPLICATION_UPDATED', 'APPLICATION_SUBMITTED', 'REVIEWER_ASSIGNED', 'DECISION_RECORDED', 'RISK_REVIEW_COMPLETED', 'RISK_REVIEW_ERROR')`
    )
    await queryRunner.query(
      `CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "action" "public"."audit_action" NOT NULL, "application_id" uuid NOT NULL, "actor_id" uuid, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`
    )
    await queryRunner.query(
      `CREATE INDEX "IDX_faca7dc2658a8e6d738d4f66dc" ON "audit_logs" ("application_id", "created_at") `
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "FK_2da4df0ec53929a13cb78d8496a" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `ALTER TABLE "merchant_applications" ADD CONSTRAINT "FK_7da78a3bb9e76995dba067b83ed" FOREIGN KEY ("assigned_reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    )
    await queryRunner.query(
      `ALTER TABLE "risk_assessments" ADD CONSTRAINT "FK_71bdfb15c3833a8f888591dee12" FOREIGN KEY ("application_id") REFERENCES "merchant_applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    )
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "risk_assessments" DROP CONSTRAINT "FK_71bdfb15c3833a8f888591dee12"`)
    await queryRunner.query(`ALTER TABLE "merchant_applications" DROP CONSTRAINT "FK_7da78a3bb9e76995dba067b83ed"`)
    await queryRunner.query(`ALTER TABLE "merchant_applications" DROP CONSTRAINT "FK_2da4df0ec53929a13cb78d8496a"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_faca7dc2658a8e6d738d4f66dc"`)
    await queryRunner.query(`DROP TABLE "audit_logs"`)
    await queryRunner.query(`DROP TYPE "public"."audit_action"`)
    await queryRunner.query(`DROP TABLE "risk_assessments"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_820ded4c4c9f905c036c10866a"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_e2e91e10700d9e012684742675"`)
    await queryRunner.query(`DROP INDEX "public"."IDX_7da78a3bb9e76995dba067b83e"`)
    await queryRunner.query(`DROP TABLE "merchant_applications"`)
    await queryRunner.query(`DROP TYPE "public"."risk_level"`)
    await queryRunner.query(`DROP TYPE "public"."risk_status"`)
    await queryRunner.query(`DROP TYPE "public"."application_status"`)
    await queryRunner.query(`DROP TYPE "public"."business_type"`)
    await queryRunner.query(`DROP TABLE "users"`)
    await queryRunner.query(`DROP TYPE "public"."user_role"`)
  }
}

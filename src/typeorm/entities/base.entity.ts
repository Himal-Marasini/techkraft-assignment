import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm"

/**
 * Common columns for every table: UUID primary key (non-enumerable IDs, which
 * matters for object-level authorization) and timezone-aware audit timestamps.
 */
export abstract class AbstractEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date
}

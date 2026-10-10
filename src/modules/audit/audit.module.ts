import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"

import { AuditLog } from "./audit-log.entity"
import { AuditRepository } from "./audit.repository"

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditRepository],
  exports: [AuditRepository]
})
export class AuditModule {}

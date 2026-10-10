import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"

import { AuditModule } from "../audit/audit.module"
import { RiskReviewModule } from "../risk-review/risk-review.module"
import { UsersModule } from "../users/users.module"
import { MerchantApplication } from "./merchant-application.entity"
import { MerchantApplicationsController } from "./merchant-applications.controller"
import { MerchantApplicationsRepository } from "./merchant-applications.repository"
import { MerchantApplicationsService } from "./merchant-applications.service"

@Module({
  imports: [TypeOrmModule.forFeature([MerchantApplication]), UsersModule, AuditModule, RiskReviewModule],
  providers: [MerchantApplicationsService, MerchantApplicationsRepository],
  controllers: [MerchantApplicationsController]
})
export class MerchantApplicationsModule {}

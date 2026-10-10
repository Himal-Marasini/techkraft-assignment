import { Injectable } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { DataSource, FindOptionsWhere, In, Repository } from "typeorm"

import { IAuditEntry } from "../audit/audit.interface"
import { AuditRepository } from "../audit/audit.repository"
import { MerchantApplication } from "./merchant-application.entity"
import {
  ICreateMerchantApplicationPayload,
  IFindMerchantApplicationPayload,
  IMerchantApplicationListFilter,
  IUpdateMerchantApplicationPayload
} from "./merchant-applications.interface"

@Injectable()
export class MerchantApplicationsRepository {
  constructor(
    @InjectRepository(MerchantApplication) private readonly repository: Repository<MerchantApplication>,
    private readonly dataSource: DataSource,
    private readonly auditRepository: AuditRepository
  ) {}

  findById(payload: IFindMerchantApplicationPayload) {
    return this.repository.findOne({ where: payload })
  }

  findMany(filter: IMerchantApplicationListFilter, page: number, pageSize: number) {
    const where: FindOptionsWhere<MerchantApplication> = {}
    if (filter.status) where.status = filter.status
    if (filter.createdById) where.createdById = filter.createdById
    if (filter.assignedReviewerId) where.assignedReviewerId = filter.assignedReviewerId

    return this.repository.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  }

  createWithAudit(payload: ICreateMerchantApplicationPayload) {
    return this.dataSource.transaction(async (manager) => {
      const entity = manager.create(MerchantApplication, payload.data)
      const record = await manager.save(entity)
      const auditEntry: IAuditEntry = { ...payload.audit, applicationId: record.id }
      await this.auditRepository.create(manager, auditEntry)
      return record
    })
  }

  updateWithAudit(payload: IUpdateMerchantApplicationPayload) {
    return this.dataSource.transaction(async (manager) => {
      const where = { ...payload.conditions, id: payload.id, status: In(payload.fromStatuses) }
      const { affected } = await manager.update(MerchantApplication, where, payload.changes)
      if (affected !== 1) return null

      const auditEntry: IAuditEntry = { ...payload.audit, applicationId: payload.id }
      await this.auditRepository.create(manager, auditEntry)

      return manager.findOneOrFail(MerchantApplication, { where: { id: payload.id } })
    })
  }
}

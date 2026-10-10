import { Injectable } from "@nestjs/common"
import { redact } from "src/utils"
import { EntityManager } from "typeorm"

import { AuditLog } from "./audit-log.entity"
import { IAuditEntry } from "./audit.interface"

@Injectable()
export class AuditRepository {
  async create(manager: EntityManager, entry: IAuditEntry) {
    // Safety net: callers pass ids/field names only, but secrets must never reach the table.
    const rawMetadata = entry.metadata ?? {}
    const metadata = redact(rawMetadata)
    await manager.insert(AuditLog, { ...entry, metadata })
  }
}

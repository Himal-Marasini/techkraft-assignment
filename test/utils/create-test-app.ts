import { getQueueToken } from "@nestjs/bullmq"
import { INestApplication } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import { Queue } from "bullmq"
import { AppModule } from "src/app.module"
import { RISK_REVIEW_QUEUE } from "src/modules/risk-review/risk-review.constant"
import { RiskReviewProcessor } from "src/modules/risk-review/risk-review.processor"

/** Boots the real AppModule (same pipes, filters, middleware, queue worker) against the test database. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()

  const app = moduleRef.createNestApplication()
  app.setGlobalPrefix("/api/v1") // keep in sync with main.ts
  await app.init()

  // Let the Redis connections finish connecting; closing a suite while they're still
  // initialising makes BullMQ emit a spurious "Connection is closed" error.
  await app.get<Queue>(getQueueToken(RISK_REVIEW_QUEUE)).waitUntilReady()
  await app.get(RiskReviewProcessor).worker.waitUntilReady()

  return app
}

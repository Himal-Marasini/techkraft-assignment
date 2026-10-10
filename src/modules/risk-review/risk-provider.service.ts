import { Injectable } from "@nestjs/common"

import { BusinessType, RiskLevel } from "../merchant-applications/merchant-applications.constant"
import { RISK_HIGH_SCORE_THRESHOLD, RISK_PROVIDER_LATENCY_MS } from "./risk-review.constant"
import { IRiskProviderInput } from "./risk-review.interface"

/**
 * Stand-in for a third-party risk/KYB API. Adds network-like latency and returns a
 * deterministic score from the requested processing profile. In a real integration this is
 * the HTTP client; errors thrown here are retried by BullMQ with backoff.
 */
@Injectable()
export class RiskProviderService {
  async assess(input: IRiskProviderInput) {
    await new Promise((resolve) => setTimeout(resolve, RISK_PROVIDER_LATENCY_MS))

    const score = calculateRiskScore(input)

    return {
      score,
      level: score >= RISK_HIGH_SCORE_THRESHOLD ? RiskLevel.HIGH : RiskLevel.LOW,
      checks: {
        volume: input.expectedMonthlyVolume > 100_000 ? "ELEVATED" : "NORMAL",
        ticketSize: input.averageTicketSize > 1_000 ? "ELEVATED" : "NORMAL",
        businessType: input.businessType
      }
    }
  }
}

export function calculateRiskScore(input: IRiskProviderInput) {
  let score = 10

  if (input.expectedMonthlyVolume > 1_000_000) score += 40
  else if (input.expectedMonthlyVolume > 100_000) score += 20

  if (input.averageTicketSize > 5_000) score += 25
  else if (input.averageTicketSize > 1_000) score += 10

  if (input.businessType === BusinessType.SOLE_PROPRIETOR) score += 10

  return Math.min(score, 100)
}

import { BusinessType, RiskLevel } from "../../merchant-applications/merchant-applications.constant"
import { calculateRiskScore, RiskProviderService } from "../risk-provider.service"

const base = {
  businessType: BusinessType.PARTNERSHIP,
  expectedMonthlyVolume: 50_000,
  averageTicketSize: 45
}

describe("simulated risk provider scoring", () => {
  it("scores a small, low-ticket partnership at the base score", () => {
    expect(calculateRiskScore(base)).toBe(10)
  })

  it("raises the score for elevated volume and ticket size", () => {
    expect(calculateRiskScore({ ...base, expectedMonthlyVolume: 200_000, averageTicketSize: 2_000 })).toBe(40)
  })

  it("scores a high-volume, high-ticket sole proprietor highest and caps at 100", () => {
    const score = calculateRiskScore({
      ...base,
      businessType: BusinessType.SOLE_PROPRIETOR,
      expectedMonthlyVolume: 5_000_000,
      averageTicketSize: 10_000
    })
    expect(score).toBe(85)
    expect(score).toBeLessThanOrEqual(100)
  })

  it("returns LOW below a score of 60 and HIGH from 60 up", async () => {
    const provider = new RiskProviderService()

    // 10 + 20 (volume > 100k) + 25 (ticket > 5k) = 55
    const low = await provider.assess({ ...base, expectedMonthlyVolume: 200_000, averageTicketSize: 6_000 })
    // 10 + 40 (volume > 1M) + 10 (ticket > 1k) = 60
    const high = await provider.assess({ ...base, expectedMonthlyVolume: 2_000_000, averageTicketSize: 2_000 })

    expect(low).toMatchObject({ score: 55, level: RiskLevel.LOW })
    expect(high).toMatchObject({ score: 60, level: RiskLevel.HIGH })
  })
})

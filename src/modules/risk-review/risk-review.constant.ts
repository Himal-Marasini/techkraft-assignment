import { DefaultJobOptions } from "bullmq"

export const RISK_REVIEW_QUEUE = "risk-review"
export const RISK_REVIEW_JOB = "assess-application"

export const RISK_REVIEW_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 }, // 2s, 4s between attempts
  removeOnComplete: 1000,
  removeOnFail: 5000
}

// Simulated third-party latency.
export const RISK_PROVIDER_LATENCY_MS = 300

// Scores (0-100) at or above this are HIGH risk for the simulated provider; anything below is LOW.
export const RISK_HIGH_SCORE_THRESHOLD = 60

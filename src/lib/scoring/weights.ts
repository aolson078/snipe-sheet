import type { SignalResults, Verdict, Confidence } from "./types";

// ── Signal Weights ─────────────────────────────────────
//
//  Signal          │ Weight │ Source
//  ────────────────┼────────┼──────────────
//  Contract safety │   35%  │ GoPlus / TokenSniffer
//  Liquidity       │   25%  │ DexScreener / on-chain
//  Holders         │   20%  │ On-chain (viem)
//  Social          │   15%  │ Farcaster/Neynar
//  Token age       │    5%  │ Block timestamp
//

const WEIGHTS = {
  contract: 0.35,
  liquidity: 0.25,
  holders: 0.2,
  social: 0.15,
  tokenAge: 0.05,
} as const;

interface WeightedScore {
  score: number;
  verdict: Verdict;
  confidence: Confidence;
  availableSignals: number;
  missingSignals: string[];
}

export function calculateWeightedScore(signals: SignalResults): WeightedScore {
  const available: { key: keyof typeof WEIGHTS; score: number }[] = [];
  const missing: string[] = [];

  if (signals.contract) available.push({ key: "contract", score: signals.contract.score });
  else missing.push("contract");

  if (signals.liquidity) available.push({ key: "liquidity", score: signals.liquidity.score });
  else missing.push("liquidity");

  if (signals.holders) available.push({ key: "holders", score: signals.holders.score });
  else missing.push("holders");

  if (signals.social) available.push({ key: "social", score: signals.social.score });
  else missing.push("social");

  if (signals.tokenAge) available.push({ key: "tokenAge", score: signals.tokenAge.score });
  else missing.push("tokenAge");

  // Pro-rata redistribution: available weights become the new denominator
  const totalAvailableWeight = available.reduce(
    (sum, s) => sum + WEIGHTS[s.key],
    0
  );

  let score: number;
  if (totalAvailableWeight === 0) {
    score = 0;
  } else {
    score = available.reduce(
      (sum, s) => sum + (s.score * WEIGHTS[s.key]) / totalAvailableWeight,
      0
    );
  }

  // Round to 1 decimal
  score = Math.round(score * 10) / 10;

  // Determine confidence
  let confidence: Confidence;
  if (missing.length === 0) confidence = "high";
  else if (missing.length === 1) confidence = "medium";
  else confidence = "low";

  // Determine verdict with false certainty guard:
  // When 2+ signals missing, verdict CAPPED at "caution" regardless of score
  let verdict: Verdict;
  if (missing.length >= 2) {
    // False certainty guard — cannot be low_risk with sparse data
    verdict = score >= 5.0 ? "caution" : "high_risk";
  } else if (score >= 8.0) {
    verdict = "low_risk";
  } else if (score >= 5.0) {
    verdict = "caution";
  } else {
    verdict = "high_risk";
  }

  return {
    score,
    verdict,
    confidence,
    availableSignals: available.length,
    missingSignals: missing,
  };
}

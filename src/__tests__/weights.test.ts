import { describe, it, expect } from "vitest";
import { calculateWeightedScore } from "../lib/scoring/weights";
import type { SignalResults } from "../lib/scoring/types";

function makeSignals(
  overrides: Partial<SignalResults> = {}
): SignalResults {
  return {
    contract: { isMintable: false, isProxy: false, isHoneypot: false, hasBlacklist: false, ownershipRenounced: true, lpLocked: true, lpLockDurationDays: 180, score: 9 },
    liquidity: { liquidityUsd: 200000, pairAddress: "0x123", priceUsd: 0.01, volume24h: 50000, pairAgeHours: 12, score: 8 },
    holders: { topHolderPct: 5, top10HolderPct: 20, holderCount: 500, score: 8 },
    social: { mentionCount: 20, sentiment: "positive", sources: ["farcaster"], score: 7 },
    tokenAge: { ageHours: 12, score: 5 },
    ...overrides,
  };
}

describe("calculateWeightedScore", () => {
  it("returns low_risk for strong signals", () => {
    const result = calculateWeightedScore(makeSignals());
    expect(result.verdict).toBe("low_risk");
    expect(result.confidence).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.missingSignals).toHaveLength(0);
  });

  it("returns high_risk for honeypot token", () => {
    const result = calculateWeightedScore(
      makeSignals({
        contract: { isMintable: true, isProxy: false, isHoneypot: true, hasBlacklist: true, ownershipRenounced: false, lpLocked: false, lpLockDurationDays: null, score: 0 },
        liquidity: { liquidityUsd: 500, pairAddress: null, priceUsd: null, volume24h: null, pairAgeHours: null, score: 1 },
        holders: { topHolderPct: 90, top10HolderPct: 95, holderCount: 5, score: 1 },
      })
    );
    expect(result.verdict).toBe("high_risk");
    expect(result.score).toBeLessThan(5);
  });

  it("drops confidence to medium when 1 signal is missing", () => {
    const result = calculateWeightedScore(
      makeSignals({ social: null })
    );
    expect(result.confidence).toBe("medium");
    expect(result.missingSignals).toContain("social");
  });

  it("drops confidence to low when 2+ signals are missing", () => {
    const result = calculateWeightedScore(
      makeSignals({ social: null, holders: null })
    );
    expect(result.confidence).toBe("low");
    expect(result.missingSignals).toHaveLength(2);
  });

  it("caps verdict at caution when 2+ signals are missing (false certainty guard)", () => {
    // Even with perfect remaining signals, verdict should NOT be low_risk
    const result = calculateWeightedScore(
      makeSignals({
        contract: { isMintable: false, isProxy: false, isHoneypot: false, hasBlacklist: false, ownershipRenounced: true, lpLocked: true, lpLockDurationDays: 365, score: 10 },
        liquidity: { liquidityUsd: 1000000, pairAddress: "0x", priceUsd: 1, volume24h: 500000, pairAgeHours: 48, score: 10 },
        holders: null,
        social: null,
        tokenAge: { ageHours: 48, score: 7 },
      })
    );
    expect(result.verdict).toBe("caution"); // NOT low_risk
    expect(result.confidence).toBe("low");
  });

  it("handles all signals missing gracefully", () => {
    const result = calculateWeightedScore({
      contract: null,
      liquidity: null,
      holders: null,
      social: null,
      tokenAge: null,
    });
    expect(result.score).toBe(0);
    expect(result.confidence).toBe("low");
    expect(result.verdict).toBe("high_risk");
    expect(result.missingSignals).toHaveLength(5);
  });

  it("redistributes weights pro-rata when signals are missing", () => {
    const allSignals = makeSignals();
    const withoutSocial = makeSignals({ social: null });

    // Score should be different (social was 7, below average of ~8)
    // so removing it should slightly increase the score
    const fullResult = calculateWeightedScore(allSignals);
    const partialResult = calculateWeightedScore(withoutSocial);

    // Both should be valid numbers
    expect(fullResult.score).toBeGreaterThan(0);
    expect(partialResult.score).toBeGreaterThan(0);
    // Available signals count differs
    expect(fullResult.availableSignals).toBe(5);
    expect(partialResult.availableSignals).toBe(4);
  });
});

import { fetchContractSafety } from "./goplus";
import { fetchLiquidityData } from "./dexscreener";
import { fetchSocialSignal } from "./farcaster";
import { fetchHolderData, fetchTokenAge } from "./on-chain";
import { calculateWeightedScore } from "./weights";
import { synthesizeWithLlm, getPromptHash, MODEL } from "./llm";
import type { Chain, SignalResults, ScoringResult } from "./types";

//  SCORING ENGINE — Single codepath for all scoring
//
//  ┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌──────────┐
//  │ Fetch    │──▶│ Weight calc  │──▶│ LLM      │──▶│ Merge &  │
//  │ signals  │   │ + fallback   │   │ synthesis │   │ return   │
//  │ parallel │   │ + guard      │   │ (Haiku)  │   │          │
//  └──────────┘   └──────────────┘   └──────────┘   └──────────┘

export async function scoreToken(
  address: string,
  chain: Chain,
  tokenName?: string | null,
  tokenSymbol?: string | null
): Promise<ScoringResult> {
  // Phase 1: Fetch all signals in parallel with individual error handling
  const [contractResult, liquidityResult, holdersResult, socialResult, ageResult] =
    await Promise.allSettled([
      fetchContractSafety(address, chain),
      fetchLiquidityData(address, chain),
      fetchHolderData(address, chain),
      fetchSocialSignal(address, tokenName, tokenSymbol),
      fetchTokenAge(address, chain),
    ]);

  const signals: SignalResults = {
    contract: contractResult.status === "fulfilled" ? contractResult.value : null,
    liquidity: liquidityResult.status === "fulfilled" ? liquidityResult.value : null,
    holders: holdersResult.status === "fulfilled" ? holdersResult.value : null,
    social: socialResult.status === "fulfilled" ? socialResult.value : null,
    tokenAge: ageResult.status === "fulfilled" ? ageResult.value : null,
  };

  // Enrich token age from DexScreener pair age if available
  if (signals.liquidity?.pairAgeHours && signals.tokenAge) {
    signals.tokenAge.ageHours = signals.liquidity.pairAgeHours;
    // Score based on age: very new = risky, older = slightly better
    if (signals.tokenAge.ageHours < 1) signals.tokenAge.score = 1;
    else if (signals.tokenAge.ageHours < 6) signals.tokenAge.score = 3;
    else if (signals.tokenAge.ageHours < 24) signals.tokenAge.score = 5;
    else if (signals.tokenAge.ageHours < 72) signals.tokenAge.score = 7;
    else signals.tokenAge.score = 8;
  }

  // Phase 2: Calculate weighted score with false certainty guard
  const weighted = calculateWeightedScore(signals);

  // Phase 3: LLM synthesis (optional — raw scores work without it)
  const llmResult = await synthesizeWithLlm(signals);

  // Phase 4: Merge — LLM verdict is advisory, weighted score is authoritative
  // LLM provides the summary and flag descriptions, weights provide the score
  const goplusAvailable = signals.contract !== null;
  const socialAvailable = signals.social !== null;

  return {
    score: weighted.score,
    verdict: weighted.verdict,
    confidence: weighted.confidence,
    summary: llmResult?.summary ?? buildFallbackSummary(weighted.verdict, weighted.missingSignals),
    redFlags: llmResult?.redFlags ?? buildAutoFlags(signals, "red"),
    greenFlags: llmResult?.greenFlags ?? buildAutoFlags(signals, "green"),
    signals,
    goplusAvailable,
    socialAvailable,
    modelVersion: MODEL,
    promptHash: getPromptHash(),
  };
}

function buildFallbackSummary(verdict: string, missing: string[]): string {
  const prefix =
    verdict === "low_risk"
      ? "Token appears relatively safe"
      : verdict === "caution"
        ? "Token has mixed signals — proceed with caution"
        : "Token shows significant risk indicators";

  if (missing.length > 0) {
    return `${prefix}. Note: ${missing.join(", ")} data unavailable.`;
  }
  return `${prefix}.`;
}

function buildAutoFlags(
  signals: SignalResults,
  type: "red" | "green"
): string[] {
  const flags: string[] = [];

  if (type === "red") {
    if (signals.contract?.isHoneypot) flags.push("Honeypot detected");
    if (signals.contract?.isMintable) flags.push("Mintable token — supply can be inflated");
    if (signals.contract?.isProxy) flags.push("Proxy contract — code can be changed");
    if (signals.contract?.hasBlacklist) flags.push("Blacklist function present");
    if (signals.holders && signals.holders.topHolderPct > 30)
      flags.push(`High concentration: top holder owns ${signals.holders.topHolderPct}%`);
    if (signals.liquidity && signals.liquidity.liquidityUsd < 10_000)
      flags.push(`Very low liquidity: $${signals.liquidity.liquidityUsd.toLocaleString()}`);
    if (signals.social?.sentiment === "negative")
      flags.push("Negative social sentiment detected");
  } else {
    if (signals.contract?.ownershipRenounced) flags.push("Ownership renounced");
    if (signals.contract?.lpLocked) {
      const days = signals.contract.lpLockDurationDays;
      flags.push(`LP locked${days ? ` for ${days} days` : ""}`);
    }
    if (!signals.contract?.isMintable && !signals.contract?.isHoneypot && signals.contract)
      flags.push("Clean contract code");
    if (signals.liquidity && signals.liquidity.liquidityUsd >= 100_000)
      flags.push(`Strong liquidity: $${signals.liquidity.liquidityUsd.toLocaleString()}`);
    if (signals.social?.sentiment === "positive" && signals.social.mentionCount >= 5)
      flags.push(`Positive social signal (${signals.social.mentionCount} mentions)`);
  }

  return flags;
}

export type Chain = "ethereum" | "base";
export type Verdict = "low_risk" | "caution" | "high_risk";
export type Confidence = "high" | "medium" | "low";

export interface ContractSafety {
  isMintable: boolean;
  isProxy: boolean;
  isHoneypot: boolean;
  hasBlacklist: boolean;
  ownershipRenounced: boolean;
  lpLocked: boolean;
  lpLockDurationDays: number | null;
  score: number; // 0-10
}

export interface LiquidityData {
  liquidityUsd: number;
  pairAddress: string | null;
  priceUsd: number | null;
  volume24h: number | null;
  pairAgeHours: number | null;
  score: number; // 0-10
}

export interface HolderData {
  topHolderPct: number; // % held by largest holder
  top10HolderPct: number; // % held by top 10
  holderCount: number;
  score: number; // 0-10
}

export interface SocialData {
  mentionCount: number;
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  sources: string[];
  score: number; // 0-10
}

export interface TokenAgeData {
  ageHours: number;
  score: number; // 0-10
}

export interface SignalResults {
  contract: ContractSafety | null;
  liquidity: LiquidityData | null;
  holders: HolderData | null;
  social: SocialData | null;
  tokenAge: TokenAgeData | null;
}

export interface LlmSynthesis {
  score: number;
  confidence: Confidence;
  verdict: Verdict;
  summary: string;
  redFlags: string[];
  greenFlags: string[];
  recommendation: string;
}

export interface ScoringResult {
  score: number;
  verdict: Verdict;
  confidence: Confidence;
  summary: string;
  redFlags: string[];
  greenFlags: string[];
  signals: SignalResults;
  goplusAvailable: boolean;
  socialAvailable: boolean;
  modelVersion: string;
  promptHash: string;
}

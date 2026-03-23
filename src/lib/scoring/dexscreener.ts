import type { Chain, LiquidityData } from "./types";

const DEX_BASE = "https://api.dexscreener.com/latest/dex";

const CHAIN_NAMES: Record<Chain, string> = {
  ethereum: "ethereum",
  base: "base",
};

interface DexScreenerPair {
  pairAddress: string;
  priceUsd: string;
  liquidity: { usd: number };
  volume: { h24: number };
  pairCreatedAt: number;
}

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

export async function fetchLiquidityData(
  address: string,
  chain: Chain
): Promise<LiquidityData> {
  const chainName = CHAIN_NAMES[chain];
  const url = `${DEX_BASE}/tokens/${address}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status === 429) {
    throw new Error("DEXSCREENER_RATE_LIMITED");
  }

  if (!response.ok) {
    throw new Error(`DexScreener API error: ${response.status}`);
  }

  const data: DexScreenerResponse = await response.json();

  // Filter pairs for the target chain and pick the one with highest liquidity
  const chainPairs = data.pairs?.filter(
    (p) => p.pairAddress && p.liquidity?.usd > 0
  );

  if (!chainPairs || chainPairs.length === 0) {
    return {
      liquidityUsd: 0,
      pairAddress: null,
      priceUsd: null,
      volume24h: null,
      pairAgeHours: null,
      score: 1, // Very new / no liquidity
    };
  }

  const bestPair = chainPairs.sort(
    (a, b) => b.liquidity.usd - a.liquidity.usd
  )[0];

  const pairAgeHours = bestPair.pairCreatedAt
    ? (Date.now() - bestPair.pairCreatedAt) / (1000 * 60 * 60)
    : null;

  // Score: 0-10
  // Liquidity thresholds for new tokens
  const liq = bestPair.liquidity.usd;
  let score = 2;
  if (liq >= 10_000) score = 4;
  if (liq >= 50_000) score = 6;
  if (liq >= 100_000) score = 7;
  if (liq >= 500_000) score = 8;
  if (liq >= 1_000_000) score = 9;

  // Volume relative to liquidity is a healthy sign
  const vol = bestPair.volume?.h24 ?? 0;
  if (liq > 0 && vol / liq > 0.5) score = Math.min(10, score + 1);

  return {
    liquidityUsd: liq,
    pairAddress: bestPair.pairAddress,
    priceUsd: bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : null,
    volume24h: vol,
    pairAgeHours: pairAgeHours ? Math.round(pairAgeHours * 10) / 10 : null,
    score,
  };
}

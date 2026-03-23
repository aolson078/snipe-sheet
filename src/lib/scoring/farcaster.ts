import type { SocialData } from "./types";

const NEYNAR_BASE = "https://api.neynar.com/v2/farcaster";

export async function fetchSocialSignal(
  address: string,
  tokenName?: string | null,
  tokenSymbol?: string | null
): Promise<SocialData> {
  // Search Farcaster for mentions of the token address or symbol
  const searchTerms = [address.slice(0, 10)]; // Short prefix of address
  if (tokenSymbol && tokenSymbol.length >= 2) {
    searchTerms.push(`$${tokenSymbol}`);
  }

  let totalMentions = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  const sources: string[] = [];

  for (const term of searchTerms) {
    try {
      const url = `${NEYNAR_BASE}/cast/search?q=${encodeURIComponent(term)}&limit=25`;
      const response = await fetch(url, {
        headers: {
          accept: "application/json",
          api_key: process.env.NEYNAR_API_KEY || "NEYNAR_API_DOCS",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error("FARCASTER_RATE_LIMITED");
        continue;
      }

      const data = await response.json();
      const casts = data?.result?.casts ?? [];
      totalMentions += casts.length;

      for (const cast of casts) {
        const text: string = cast.text?.toLowerCase() ?? "";
        if (
          text.includes("scam") ||
          text.includes("rug") ||
          text.includes("honeypot") ||
          text.includes("avoid")
        ) {
          negativeCount++;
        } else if (
          text.includes("gem") ||
          text.includes("bullish") ||
          text.includes("moon") ||
          text.includes("alpha")
        ) {
          positiveCount++;
        }
        if (!sources.includes("farcaster")) sources.push("farcaster");
      }
    } catch (err) {
      if (err instanceof Error && err.message === "FARCASTER_RATE_LIMITED") {
        throw err;
      }
      // Non-rate-limit errors: skip this search term
    }
  }

  // Determine sentiment
  let sentiment: SocialData["sentiment"] = "unknown";
  if (totalMentions > 0) {
    if (negativeCount > positiveCount) sentiment = "negative";
    else if (positiveCount > negativeCount) sentiment = "positive";
    else sentiment = "neutral";
  }

  // Score: 0-10
  // More mentions = more signal (not necessarily better)
  // Negative sentiment penalizes
  let score = 5;
  if (totalMentions === 0) score = 3; // No social signal
  if (totalMentions >= 5) score = 5;
  if (totalMentions >= 15) score = 7;
  if (totalMentions >= 30) score = 8;
  if (sentiment === "negative") score = Math.max(1, score - 3);
  if (sentiment === "positive" && totalMentions >= 5) score = Math.min(10, score + 1);

  return {
    mentionCount: totalMentions,
    sentiment,
    sources,
    score,
  };
}

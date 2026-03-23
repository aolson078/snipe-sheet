import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import type { SignalResults, LlmSynthesis } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are a DeFi token risk analyst. Given on-chain and social data about a newly launched token, produce a risk assessment. Be direct. No hedging. State the facts and your verdict clearly.

You MUST respond with valid JSON matching this exact schema:
{
  "score": <number 0-10>,
  "confidence": "<high|medium|low>",
  "verdict": "<low_risk|caution|high_risk>",
  "summary": "<one sentence verdict>",
  "red_flags": ["<flag1>", "<flag2>"],
  "green_flags": ["<flag1>", "<flag2>"],
  "recommendation": "<one sentence recommendation>"
}`;

function sanitizeForPrompt(value: string | null | undefined): string {
  if (!value) return "unknown";
  // Strip control chars, HTML, and truncate
  return value
    .replace(/[<>'"&\\]/g, "")
    .replace(/[\x00-\x1f]/g, "")
    .slice(0, 50);
}

function buildUserPrompt(signals: SignalResults): string {
  const parts: string[] = ["Analyze this token launch:\n"];

  if (signals.contract) {
    parts.push(`CONTRACT SAFETY (score: ${signals.contract.score}/10):`);
    parts.push(`  Mintable: ${signals.contract.isMintable}`);
    parts.push(`  Proxy: ${signals.contract.isProxy}`);
    parts.push(`  Honeypot: ${signals.contract.isHoneypot}`);
    parts.push(`  Blacklist: ${signals.contract.hasBlacklist}`);
    parts.push(`  Ownership renounced: ${signals.contract.ownershipRenounced}`);
    parts.push(`  LP locked: ${signals.contract.lpLocked} (${signals.contract.lpLockDurationDays ?? "unknown"} days)`);
  } else {
    parts.push("CONTRACT SAFETY: data unavailable");
  }

  if (signals.liquidity) {
    parts.push(`\nLIQUIDITY (score: ${signals.liquidity.score}/10):`);
    parts.push(`  Liquidity: $${signals.liquidity.liquidityUsd.toLocaleString()}`);
    parts.push(`  24h volume: $${(signals.liquidity.volume24h ?? 0).toLocaleString()}`);
    parts.push(`  Pair age: ${signals.liquidity.pairAgeHours ?? "unknown"} hours`);
  } else {
    parts.push("\nLIQUIDITY: data unavailable");
  }

  if (signals.holders) {
    parts.push(`\nHOLDER DISTRIBUTION (score: ${signals.holders.score}/10):`);
    parts.push(`  Top holder: ${signals.holders.topHolderPct}%`);
  } else {
    parts.push("\nHOLDER DISTRIBUTION: data unavailable");
  }

  if (signals.social) {
    parts.push(`\nSOCIAL SIGNAL (score: ${signals.social.score}/10):`);
    parts.push(`  Mentions: ${signals.social.mentionCount}`);
    parts.push(`  Sentiment: ${signals.social.sentiment}`);
  } else {
    parts.push("\nSOCIAL SIGNAL: data unavailable");
  }

  if (signals.tokenAge) {
    parts.push(`\nTOKEN AGE: ${signals.tokenAge.ageHours} hours`);
  }

  return parts.join("\n");
}

export function getPromptHash(): string {
  return createHash("sha256").update(SYSTEM_PROMPT).digest("hex").slice(0, 12);
}

export async function synthesizeWithLlm(
  signals: SignalResults
): Promise<LlmSynthesis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY not set — skipping LLM synthesis");
    return null;
  }

  const client = new Anthropic({ apiKey });
  const userPrompt = buildUserPrompt(signals);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("LLM returned no JSON:", text.slice(0, 200));
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      score: Number(parsed.score) || 5,
      confidence: parsed.confidence || "medium",
      verdict: parsed.verdict || "caution",
      summary: String(parsed.summary || "Analysis complete."),
      redFlags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
      greenFlags: Array.isArray(parsed.green_flags) ? parsed.green_flags : [],
      recommendation: String(parsed.recommendation || ""),
    };
  } catch (err) {
    console.error("LLM synthesis failed:", err);
    return null;
  }
}

export { sanitizeForPrompt, MODEL };

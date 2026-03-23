import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tokens, tokenScores } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { addressSchema, chainSchema } from "@/lib/validate";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string; chain: string }> }
) {
  const { address, chain } = await params;

  // Validate
  const addrParsed = addressSchema.safeParse(address);
  const chainParsed = chainSchema.safeParse(chain);

  if (!addrParsed.success) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (!chainParsed.success) {
    return NextResponse.json(
      { error: "Invalid chain. Use 'ethereum' or 'base'" },
      { status: 400 }
    );
  }

  const token = await db.query.tokens.findFirst({
    where: and(
      eq(tokens.address, address.toLowerCase()),
      eq(tokens.chain, chainParsed.data)
    ),
  });

  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  // Get the latest score
  const latestScore = await db.query.tokenScores.findFirst({
    where: eq(tokenScores.tokenId, token.id),
    orderBy: [desc(tokenScores.scoredAt)],
  });

  if (!latestScore) {
    return NextResponse.json(
      { error: "Score not found — token may still be processing" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    token: {
      address: token.address,
      chain: token.chain,
      name: token.name,
      symbol: token.symbol,
    },
    score: {
      id: latestScore.id,
      score: parseFloat(latestScore.score),
      verdict: latestScore.verdict,
      confidence: latestScore.confidence,
      summary: latestScore.summary,
      redFlags: latestScore.redFlags,
      greenFlags: latestScore.greenFlags,
      goplusAvailable: latestScore.goplusAvailable,
      socialAvailable: latestScore.socialAvailable,
      scoredAt: latestScore.scoredAt,
    },
  });
}

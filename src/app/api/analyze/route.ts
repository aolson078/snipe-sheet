import { NextRequest, NextResponse } from "next/server";
import { analyzeSchema } from "@/lib/validate";
import { scoreToken } from "@/lib/scoring/engine";
import { db } from "@/lib/db/client";
import { tokens, tokenScores } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const maxDuration = 30; // Allow up to 30s for scoring on Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = analyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { address, chain } = parsed.data;
    const normalizedAddress = address.toLowerCase();

    // Score inline — no Redis/worker dependency
    // This runs the full scoring pipeline in the serverless function
    const result = await scoreToken(normalizedAddress, chain);

    // Upsert token record
    let tokenRecord = await db.query.tokens.findFirst({
      where: and(
        eq(tokens.address, normalizedAddress),
        eq(tokens.chain, chain)
      ),
    });

    if (!tokenRecord) {
      const [inserted] = await db
        .insert(tokens)
        .values({ address: normalizedAddress, chain })
        .onConflictDoNothing()
        .returning();

      tokenRecord = inserted ?? await db.query.tokens.findFirst({
        where: and(
          eq(tokens.address, normalizedAddress),
          eq(tokens.chain, chain)
        ),
      });
    }

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "Failed to create token record" },
        { status: 500 }
      );
    }

    // Persist the score
    const [score] = await db
      .insert(tokenScores)
      .values({
        tokenId: tokenRecord.id,
        score: result.score.toString(),
        verdict: result.verdict,
        confidence: result.confidence,
        summary: result.summary,
        redFlags: result.redFlags,
        greenFlags: result.greenFlags,
        rawSignals: result.signals as unknown as Record<string, unknown>,
        goplusAvailable: result.goplusAvailable,
        socialAvailable: result.socialAvailable,
        modelVersion: result.modelVersion,
        promptHash: result.promptHash,
      })
      .returning({ id: tokenScores.id });

    return NextResponse.json({
      scoreId: score.id,
      score: result.score,
      verdict: result.verdict,
      redirect: `/token/${normalizedAddress}/${chain}`,
    });
  } catch (err) {
    console.error("[api/analyze] Error:", err);
    return NextResponse.json(
      { error: "Scoring failed. Please try again." },
      { status: 500 }
    );
  }
}

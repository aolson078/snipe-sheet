import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { tokens, tokenScores } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor"); // scored_at ISO string for pagination
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  // TODO: Add auth check. Free users get 3 results, Pro+ get full feed.
  // For now, return full feed during development.

  try {
    const query = db
      .select({
        scoreId: tokenScores.id,
        score: tokenScores.score,
        verdict: tokenScores.verdict,
        confidence: tokenScores.confidence,
        summary: tokenScores.summary,
        scoredAt: tokenScores.scoredAt,
        goplusAvailable: tokenScores.goplusAvailable,
        socialAvailable: tokenScores.socialAvailable,
        tokenAddress: tokens.address,
        tokenChain: tokens.chain,
        tokenName: tokens.name,
        tokenSymbol: tokens.symbol,
      })
      .from(tokenScores)
      .innerJoin(tokens, eq(tokenScores.tokenId, tokens.id))
      .orderBy(desc(tokenScores.scoredAt))
      .limit(limit + 1); // Fetch one extra for "has more" detection

    // Cursor-based pagination
    if (cursor) {
      query.where(sql`${tokenScores.scoredAt} < ${new Date(cursor)}`);
    }

    const results = await query;
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore
      ? items[items.length - 1].scoredAt?.toISOString()
      : null;

    return NextResponse.json({
      items: items.map((r) => ({
        scoreId: r.scoreId,
        score: parseFloat(r.score),
        verdict: r.verdict,
        confidence: r.confidence,
        summary: r.summary,
        scoredAt: r.scoredAt,
        goplusAvailable: r.goplusAvailable,
        socialAvailable: r.socialAvailable,
        token: {
          address: r.tokenAddress,
          chain: r.tokenChain,
          name: r.tokenName,
          symbol: r.tokenSymbol,
        },
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    console.error("[api/feed] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

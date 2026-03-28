import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { watchlistItems, tokens, tokenScores } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const addSchema = z.object({
  tokenId: z.string().uuid(),
  scoreAtAdd: z.number().min(0).max(10),
  verdictAtAdd: z.enum(["low_risk", "caution", "high_risk"]),
  alertThreshold: z.number().min(0).max(10).optional(),
});

// GET /api/watchlist — list current user's watched tokens
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select({
      id: watchlistItems.id,
      tokenId: watchlistItems.tokenId,
      scoreAtAdd: watchlistItems.scoreAtAdd,
      verdictAtAdd: watchlistItems.verdictAtAdd,
      alertThreshold: watchlistItems.alertThreshold,
      createdAt: watchlistItems.createdAt,
      tokenAddress: tokens.address,
      tokenChain: tokens.chain,
      tokenName: tokens.name,
      tokenSymbol: tokens.symbol,
    })
    .from(watchlistItems)
    .innerJoin(tokens, eq(watchlistItems.tokenId, tokens.id))
    .where(eq(watchlistItems.userId, session.user.id))
    .orderBy(desc(watchlistItems.createdAt));

  // Fetch latest score for each watched token
  const enriched = await Promise.all(
    items.map(async (item) => {
      const [latestScore] = await db
        .select({
          score: tokenScores.score,
          verdict: tokenScores.verdict,
          confidence: tokenScores.confidence,
          scoredAt: tokenScores.scoredAt,
        })
        .from(tokenScores)
        .where(eq(tokenScores.tokenId, item.tokenId))
        .orderBy(desc(tokenScores.scoredAt))
        .limit(1);

      return {
        id: item.id,
        scoreAtAdd: parseFloat(item.scoreAtAdd),
        verdictAtAdd: item.verdictAtAdd,
        alertThreshold: item.alertThreshold ? parseFloat(item.alertThreshold) : 2.0,
        addedAt: item.createdAt,
        token: {
          id: item.tokenId,
          address: item.tokenAddress,
          chain: item.tokenChain,
          name: item.tokenName,
          symbol: item.tokenSymbol,
        },
        latestScore: latestScore
          ? {
              score: parseFloat(latestScore.score),
              verdict: latestScore.verdict,
              confidence: latestScore.confidence,
              scoredAt: latestScore.scoredAt,
            }
          : null,
      };
    })
  );

  return NextResponse.json({ items: enriched });
}

// POST /api/watchlist — add a token to watchlist
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tokenId, scoreAtAdd, verdictAtAdd, alertThreshold } = parsed.data;

  try {
    const [item] = await db
      .insert(watchlistItems)
      .values({
        userId: session.user.id,
        tokenId,
        scoreAtAdd: scoreAtAdd.toFixed(2),
        verdictAtAdd,
        alertThreshold: (alertThreshold ?? 2.0).toFixed(2),
      })
      .onConflictDoNothing()
      .returning();

    if (!item) {
      return NextResponse.json(
        { error: "Token already on watchlist" },
        { status: 409 }
      );
    }

    return NextResponse.json({ id: item.id }, { status: 201 });
  } catch (err) {
    console.error("[api/watchlist] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/watchlist — remove a token from watchlist
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("id");
  if (!itemId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const deleted = await db
    .delete(watchlistItems)
    .where(
      and(
        eq(watchlistItems.id, itemId),
        eq(watchlistItems.userId, session.user.id)
      )
    )
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

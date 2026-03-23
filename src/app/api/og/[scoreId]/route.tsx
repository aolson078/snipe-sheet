import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { tokenScores, tokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "edge";

const VERDICT_COLORS: Record<string, string> = {
  low_risk: "#22c55e",
  caution: "#eab308",
  high_risk: "#ef4444",
};

const VERDICT_LABELS: Record<string, string> = {
  low_risk: "LOW RISK",
  caution: "CAUTION",
  high_risk: "HIGH RISK",
};

function sanitize(value: string | null | undefined, maxLen: number): string {
  if (!value) return "Unknown";
  return value
    .replace(/[<>'"&\\]/g, "")
    .replace(/[\x00-\x1f]/g, "")
    .slice(0, maxLen);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scoreId: string }> }
) {
  const { scoreId } = await params;

  // Validate UUID format
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      scoreId
    )
  ) {
    return new Response("Not found", { status: 404 });
  }

  const score = await db.query.tokenScores.findFirst({
    where: eq(tokenScores.id, scoreId),
  });

  if (!score) {
    return new Response("Not found", { status: 404 });
  }

  const token = await db.query.tokens.findFirst({
    where: eq(tokens.id, score.tokenId),
  });

  const name = sanitize(token?.name, 32);
  const symbol = sanitize(token?.symbol, 10);
  const verdict = score.verdict;
  const color = VERDICT_COLORS[verdict] ?? "#a1a1aa";
  const label = VERDICT_LABELS[verdict] ?? "UNKNOWN";
  const scoreNum = parseFloat(score.score).toFixed(1);
  const flags = [
    ...((score.redFlags as string[]) ?? []).slice(0, 2),
    ...((score.greenFlags as string[]) ?? []).slice(0, 1),
  ].slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          backgroundColor: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          padding: "60px",
        }}
      >
        {/* Brand */}
        <div
          style={{
            position: "absolute",
            top: "30px",
            left: "40px",
            fontSize: "20px",
            color: "#71717a",
            display: "flex",
          }}
        >
          SNIPE
          <span style={{ color: "#22c55e" }}>SHEET</span>
        </div>

        {/* Token name */}
        <div
          style={{
            fontSize: "28px",
            color: "#a1a1aa",
            marginBottom: "16px",
            display: "flex",
          }}
        >
          {symbol !== "Unknown" ? `$${symbol}` : name}
        </div>

        {/* Score */}
        <div
          style={{
            fontSize: "96px",
            fontWeight: "bold",
            color,
            lineHeight: 1,
            display: "flex",
          }}
        >
          {scoreNum}
        </div>

        {/* Verdict */}
        <div
          style={{
            fontSize: "24px",
            color,
            border: `2px solid ${color}`,
            borderRadius: "6px",
            padding: "6px 20px",
            marginTop: "16px",
            display: "flex",
          }}
        >
          {label}
        </div>

        {/* Flags */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "32px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {flags.map((flag, i) => (
            <div
              key={i}
              style={{
                fontSize: "14px",
                color: "#a1a1aa",
                backgroundColor: "#141414",
                border: "1px solid #262626",
                borderRadius: "4px",
                padding: "6px 12px",
                display: "flex",
              }}
            >
              {sanitize(flag, 50)}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            fontSize: "16px",
            color: "#71717a",
            display: "flex",
          }}
        >
          snipesheet.xyz — Token launch intelligence
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

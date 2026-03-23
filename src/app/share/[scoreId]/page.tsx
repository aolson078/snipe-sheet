import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { tokenScores, tokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ scoreId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { scoreId } = await params;
  const score = await db.query.tokenScores.findFirst({
    where: eq(tokenScores.id, scoreId),
  });

  if (!score) return { title: "Snipe Sheet" };

  const token = await db.query.tokens.findFirst({
    where: eq(tokens.id, score.tokenId),
  });

  const name = token?.symbol ? `$${token.symbol}` : "Token";
  const scoreNum = parseFloat(score.score).toFixed(1);

  return {
    title: `${name} scored ${scoreNum} — Snipe Sheet`,
    description: score.summary || "Token launch risk analysis",
    openGraph: {
      title: `${name} scored ${scoreNum}`,
      description: score.summary || "Token launch risk analysis",
      images: [
        {
          url: `/api/og/${scoreId}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} scored ${scoreNum}`,
      description: score.summary || "Token launch risk analysis",
      images: [`/api/og/${scoreId}`],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { scoreId } = await params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      scoreId
    )
  ) {
    notFound();
  }

  const score = await db.query.tokenScores.findFirst({
    where: eq(tokenScores.id, scoreId),
  });

  if (!score) notFound();

  const token = await db.query.tokens.findFirst({
    where: eq(tokens.id, score.tokenId),
  });

  if (!token) notFound();

  // Redirect to the full token detail page
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <p className="text-[#71717a] text-sm font-mono mb-4">
        Redirecting to full analysis...
      </p>
      <a
        href={`/token/${token.address}/${token.chain}`}
        className="text-[#22c55e] font-mono hover:underline"
      >
        View full score for {token.symbol ? `$${token.symbol}` : token.address}
      </a>
      <div className="mt-8">
        <a
          href="/"
          className="px-6 py-3 bg-[#22c55e] text-[#0a0a0a] font-mono font-bold rounded hover:bg-[#16a34a] transition-colors"
        >
          Check any token
        </a>
      </div>
      <meta
        httpEquiv="refresh"
        content={`2;url=/token/${token.address}/${token.chain}`}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { ScoreBadge } from "@/components/ScoreBadge";
import { SignalBar } from "@/components/SignalBar";

interface SignalScores {
  contract: { score: number } | null;
  liquidity: { score: number } | null;
  holders: { score: number } | null;
  social: { score: number } | null;
  tokenAge: { score: number } | null;
}

interface TokenScore {
  token: {
    id: string;
    address: string;
    chain: string;
    name: string | null;
    symbol: string | null;
  };
  score: {
    id: string;
    score: number;
    verdict: "low_risk" | "caution" | "high_risk";
    confidence: "high" | "medium" | "low";
    summary: string;
    redFlags: string[];
    greenFlags: string[];
    rawSignals: SignalScores | null;
    goplusAvailable: boolean;
    socialAvailable: boolean;
    scoredAt: string;
  };
}

export default function TokenDetailPage() {
  const params = useParams<{ address: string; chain: string }>();
  const [data, setData] = useState<TokenScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [watched, setWatched] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const posthog = usePostHog();

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 15; // Poll for up to ~30 seconds

    async function poll() {
      try {
        const res = await fetch(
          `/api/token/${params.address}/${params.chain}`
        );
        if (res.status === 404 && attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
          return;
        }
        if (!res.ok) {
          setError("Token not found or scoring failed.");
          setLoading(false);
          return;
        }
        const json = await res.json();
        setData(json);
        setLoading(false);
        posthog?.capture("score_viewed", {
          chain: params.chain,
          verdict: json.score?.verdict,
          confidence: json.score?.confidence,
          score: json.score?.score,
        });
      } catch {
        setError("Network error");
        setLoading(false);
      }
    }

    poll();
  }, [params.address, params.chain]);

  async function handleWatch() {
    if (!data) return;
    setWatchLoading(true);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: data.token.id,
          scoreAtAdd: data.score.score,
          verdictAtAdd: data.score.verdict,
        }),
      });
      if (res.ok || res.status === 409) {
        setWatched(true);
      }
    } catch {
      // silently fail
    } finally {
      setWatchLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="flex flex-col items-center gap-6">
          <div className="skeleton w-24 h-16" />
          <div className="skeleton w-48 h-6" />
          <div className="w-full space-y-3 mt-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton w-full h-8" />
            ))}
          </div>
        </div>
        <p className="text-center text-[#71717a] text-sm mt-8 font-mono">
          Analyzing token...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-[#ef4444] font-mono">{error || "Score not found"}</p>
        <a
          href="/"
          className="inline-block mt-4 text-[#a1a1aa] hover:text-white font-mono text-sm"
        >
          Try another token
        </a>
      </div>
    );
  }

  const { token, score } = data;
  const signals = score.rawSignals;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Degraded banner */}
      {(!score.goplusAvailable || !score.socialAvailable) && (
        <div className="bg-[#262626] border border-[#eab308]/30 rounded px-4 py-2 mb-6 text-sm font-mono text-[#eab308]">
          DEGRADED — {!score.goplusAvailable && "contract data"}{" "}
          {!score.goplusAvailable && !score.socialAvailable && "and "}{" "}
          {!score.socialAvailable && "social data"} unavailable
        </div>
      )}

      {/* Header: name + address */}
      <div className="text-center mb-8">
        <h1 className="font-mono text-xl font-bold">
          {token.symbol ? `$${token.symbol}` : "Unknown Token"}
        </h1>
        <p className="text-[#71717a] font-mono text-xs mt-1 break-all">
          {token.address} · {token.chain}
        </p>
      </div>

      {/* Score badge */}
      <div className="flex justify-center mb-8">
        <ScoreBadge score={score.score} verdict={score.verdict} />
      </div>

      {/* Summary */}
      <p className="text-center text-[#a1a1aa] text-sm mb-8">
        {score.summary}
      </p>

      {/* Confidence */}
      <div className="text-center mb-8">
        <span className="text-xs font-mono text-[#71717a]">
          Confidence:{" "}
          <span
            className={
              score.confidence === "high"
                ? "text-[#22c55e]"
                : score.confidence === "medium"
                  ? "text-[#eab308]"
                  : "text-[#ef4444]"
            }
          >
            {score.confidence.toUpperCase()}
          </span>
        </span>
      </div>

      {/* Signal breakdown */}
      <div className="border border-[#262626] rounded p-4 mb-6">
        <h2 className="font-mono text-sm text-[#71717a] mb-4">
          Signal Breakdown
        </h2>
        <SignalBar
          label="Contract"
          score={signals?.contract?.score ?? 0}
          detail={score.goplusAvailable ? "GoPlus verified" : ""}
          available={score.goplusAvailable}
        />
        <SignalBar label="Liquidity" score={signals?.liquidity?.score ?? 0} detail="" />
        <SignalBar label="Holders" score={signals?.holders?.score ?? 0} detail="" />
        <SignalBar
          label="Social"
          score={signals?.social?.score ?? 0}
          detail=""
          available={score.socialAvailable}
        />
        <SignalBar label="Age" score={signals?.tokenAge?.score ?? 0} detail="" />
      </div>

      {/* Flags */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {score.redFlags.length > 0 && (
          <div>
            <h3 className="font-mono text-xs text-[#ef4444] mb-2">
              Red Flags
            </h3>
            <div className="space-y-1">
              {score.redFlags.map((flag, i) => (
                <div
                  key={i}
                  className="text-xs font-mono text-[#a1a1aa] bg-[#141414] border border-[#ef4444]/20 rounded px-2 py-1"
                >
                  {flag}
                </div>
              ))}
            </div>
          </div>
        )}
        {score.greenFlags.length > 0 && (
          <div>
            <h3 className="font-mono text-xs text-[#22c55e] mb-2">
              Green Flags
            </h3>
            <div className="space-y-1">
              {score.greenFlags.map((flag, i) => (
                <div
                  key={i}
                  className="text-xs font-mono text-[#a1a1aa] bg-[#141414] border border-[#22c55e]/20 rounded px-2 py-1"
                >
                  {flag}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <button
          onClick={handleWatch}
          disabled={watched || watchLoading}
          className={`px-4 py-2 text-sm font-mono border rounded transition-colors ${
            watched
              ? "border-[#22c55e]/40 text-[#22c55e] cursor-default"
              : "border-[#262626] hover:bg-[#141414] hover:border-[#22c55e]/40"
          } disabled:opacity-60`}
        >
          {watched ? "Watching" : watchLoading ? "..." : "Watch"}
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              `${window.location.origin}/share/${score.id}`
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            posthog?.capture("share_clicked", { verdict: score.verdict });
          }}
          className="px-4 py-2 text-sm font-mono border border-[#262626] rounded hover:bg-[#141414] transition-colors"
        >
          {copied ? "Copied!" : "Share"}
        </button>
        <a
          href="/"
          className="px-4 py-2 text-sm font-mono border border-[#262626] rounded hover:bg-[#141414] transition-colors"
        >
          Check Another
        </a>
      </div>

      {/* Scored at */}
      <p className="text-center text-[#71717a] text-xs font-mono mt-8">
        Scored {new Date(score.scoredAt).toLocaleString()}
      </p>
    </div>
  );
}

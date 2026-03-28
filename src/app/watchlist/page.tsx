"use client";

import { useEffect, useState, useCallback } from "react";
import { ScoreBadge } from "@/components/ScoreBadge";

type Verdict = "low_risk" | "caution" | "high_risk";

interface WatchlistItem {
  id: string;
  scoreAtAdd: number;
  verdictAtAdd: Verdict;
  alertThreshold: number;
  addedAt: string;
  token: {
    id: string;
    address: string;
    chain: string;
    name: string | null;
    symbol: string | null;
  };
  latestScore: {
    score: number;
    verdict: Verdict;
    confidence: string;
    scoredAt: string;
  } | null;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.status === 401) {
        setError("Sign in to view your watchlist.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Failed to load watchlist.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setItems(data.items);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  async function handleRemove(itemId: string) {
    setRemoving(itemId);
    try {
      const res = await fetch(`/api/watchlist?id=${itemId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    } catch {
      // silently fail
    } finally {
      setRemoving(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-mono text-lg font-bold mb-6">Watchlist</h1>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton w-full h-12" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="font-mono text-lg font-bold mb-4">Watchlist</h1>
        <p className="text-[#71717a] font-mono">{error}</p>
        <a
          href="/"
          className="inline-block mt-4 text-[#a1a1aa] hover:text-white font-mono text-sm"
        >
          Go home
        </a>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="font-mono text-lg font-bold mb-4">Watchlist</h1>
        <p className="text-[#71717a] font-mono text-sm">
          No tokens on your watchlist yet.
        </p>
        <p className="text-[#71717a] font-mono text-xs mt-2">
          Score a token and click &quot;Watch&quot; to track it here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-mono text-lg font-bold mb-6">Watchlist</h1>

      <div className="border border-[#262626] rounded overflow-hidden">
        <table className="w-full text-sm font-mono" role="table">
          <thead>
            <tr className="bg-[#141414] text-[#71717a] text-xs">
              <th className="text-left px-4 py-2">Token</th>
              <th className="text-left px-4 py-2">Current</th>
              <th className="text-left px-4 py-2 hidden md:table-cell">
                When Added
              </th>
              <th className="text-left px-4 py-2 hidden lg:table-cell">
                Change
              </th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const current = item.latestScore;
              const delta = current
                ? current.score - item.scoreAtAdd
                : null;

              return (
                <tr
                  key={item.id}
                  className="border-t border-[#262626] hover:bg-[#1a1a1a] transition-colors"
                >
                  <td
                    className="px-4 py-3 cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/token/${item.token.address}/${item.token.chain}`)
                    }
                  >
                    <span className="text-white">
                      {item.token.symbol
                        ? `$${item.token.symbol}`
                        : item.token.address.slice(0, 10) + "..."}
                    </span>
                    <span className="text-[#71717a] text-xs ml-2 hidden sm:inline">
                      {item.token.chain}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {current ? (
                      <ScoreBadge
                        score={current.score}
                        verdict={current.verdict}
                        size="sm"
                      />
                    ) : (
                      <span className="text-[#71717a] text-xs">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#71717a] text-xs hidden md:table-cell">
                    <ScoreBadge
                      score={item.scoreAtAdd}
                      verdict={item.verdictAtAdd}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {delta !== null ? (
                      <span
                        className={`text-xs font-mono ${
                          delta > 0
                            ? "text-[#22c55e]"
                            : delta < 0
                              ? "text-[#ef4444]"
                              : "text-[#71717a]"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[#71717a] text-xs">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(item.id)}
                      disabled={removing === item.id}
                      className="text-xs text-[#71717a] hover:text-[#ef4444] transition-colors disabled:opacity-50"
                    >
                      {removing === item.id ? "..." : "Remove"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

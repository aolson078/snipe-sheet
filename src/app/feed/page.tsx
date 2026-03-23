"use client";

import { useEffect, useState, useCallback } from "react";
import { ScoreBadge } from "@/components/ScoreBadge";

interface FeedItem {
  scoreId: string;
  score: number;
  verdict: "low_risk" | "caution" | "high_risk";
  confidence: string;
  summary: string;
  scoredAt: string;
  goplusAvailable: boolean;
  socialAvailable: boolean;
  token: {
    address: string;
    chain: string;
    name: string | null;
    symbol: string | null;
  };
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchFeed = useCallback(async (cursor?: string) => {
    try {
      const url = cursor
        ? `/api/feed?cursor=${encodeURIComponent(cursor)}`
        : "/api/feed";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (cursor) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // Network error — silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    // Poll every 30s for new launches
    const interval = setInterval(() => fetchFeed(), 30_000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-mono text-lg font-bold mb-6">Launch Feed</h1>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="skeleton w-full h-12" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="font-mono text-lg font-bold mb-4">Launch Feed</h1>
        <div className="text-[#71717a] font-mono">
          <p className="text-4xl mb-4">📡</p>
          <p>No new tokens detected yet. Monitoring...</p>
          <p className="text-xs mt-2">
            Feed updates every 30 seconds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-mono text-lg font-bold mb-6">Launch Feed</h1>

      {/* Table */}
      <div className="border border-[#262626] rounded overflow-hidden">
        <table className="w-full text-sm font-mono" role="table">
          <thead>
            <tr className="bg-[#141414] text-[#71717a] text-xs">
              <th className="text-left px-4 py-2">Score</th>
              <th className="text-left px-4 py-2">Token</th>
              <th className="text-left px-4 py-2 hidden md:table-cell">
                Chain
              </th>
              <th className="text-left px-4 py-2 hidden lg:table-cell">
                Summary
              </th>
              <th className="text-right px-4 py-2">Age</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.scoreId}
                className="border-t border-[#262626] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                onClick={() =>
                  (window.location.href = `/token/${item.token.address}/${item.token.chain}`)
                }
              >
                <td className="px-4 py-3">
                  <ScoreBadge
                    score={item.score}
                    verdict={item.verdict}
                    size="sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-white">
                    {item.token.symbol
                      ? `$${item.token.symbol}`
                      : item.token.address.slice(0, 10) + "..."}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#71717a] hidden md:table-cell">
                  {item.token.chain}
                </td>
                <td className="px-4 py-3 text-[#71717a] text-xs hidden lg:table-cell max-w-xs truncate">
                  {item.summary}
                </td>
                <td className="px-4 py-3 text-right text-[#71717a] text-xs">
                  {formatAge(item.scoredAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={() => nextCursor && fetchFeed(nextCursor)}
            className="px-4 py-2 text-sm font-mono text-[#a1a1aa] border border-[#262626] rounded hover:bg-[#141414] transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

function formatAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState<"ethereum" | "base">("ethereum");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setError("Invalid address — must be a 0x... Ethereum address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed, chain }),
      });

      if (res.status === 429) {
        setError("Rate limit reached. Upgrade to Pro for unlimited checks.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong");
        return;
      }

      router.push(`/token/${trimmed}/${chain}`);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] px-4">
      <div className="w-full max-w-[600px] text-center">
        <p className="text-[#71717a] text-sm mb-8 tracking-widest uppercase font-mono">
          Paste. Score. Decide.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setError(null);
            }}
            placeholder="0x... paste any token address"
            className={`w-full bg-[#141414] border ${
              error
                ? "border-[#ef4444]"
                : loading
                  ? "border-[#22c55e] animate-pulse"
                  : "border-[#262626]"
            } rounded px-4 py-4 text-base font-mono text-[#fafafa] placeholder:text-[#71717a] focus:outline-none focus:border-[#a1a1aa] transition-colors`}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setChain("ethereum")}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                chain === "ethereum"
                  ? "bg-[#262626] text-white"
                  : "text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              Ethereum
            </button>
            <button
              type="button"
              onClick={() => setChain("base")}
              className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                chain === "base"
                  ? "bg-[#262626] text-white"
                  : "text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              Base
            </button>
          </div>

          {error && (
            <p className="text-[#ef4444] text-sm font-mono" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="w-full bg-[#22c55e] text-[#0a0a0a] font-mono font-bold py-3 rounded hover:bg-[#16a34a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Analyzing..." : "Score Token"}
          </button>
        </form>

        <p className="text-[#71717a] text-xs mt-12 font-mono">
          Snipe Sheet provides risk analysis only. Not financial advice.
        </p>
      </div>
    </div>
  );
}

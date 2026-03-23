export function SignalBar({
  label,
  score,
  detail,
  available = true,
}: {
  label: string;
  score: number;
  detail: string;
  available?: boolean;
}) {
  if (!available) {
    return (
      <div className="flex items-center gap-4 py-2">
        <span className="w-24 text-sm text-[#71717a] font-mono">{label}</span>
        <span className="text-xs text-[#71717a] italic">unavailable</span>
      </div>
    );
  }

  const pct = Math.round((score / 10) * 100);
  const barColor =
    score >= 7 ? "#22c55e" : score >= 4 ? "#eab308" : "#ef4444";

  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-24 text-sm text-[#a1a1aa] font-mono shrink-0">
        {label}
      </span>
      <span className="font-mono text-sm w-8 text-right">{score}/10</span>
      <div className="flex-1 h-2 bg-[#262626] rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="text-xs text-[#71717a] font-mono truncate max-w-[200px]">
        {detail}
      </span>
    </div>
  );
}

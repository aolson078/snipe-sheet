type Verdict = "low_risk" | "caution" | "high_risk";

const VERDICT_COLORS: Record<Verdict, string> = {
  low_risk: "#22c55e",
  caution: "#eab308",
  high_risk: "#ef4444",
};

const VERDICT_LABELS: Record<Verdict, string> = {
  low_risk: "LOW RISK",
  caution: "CAUTION",
  high_risk: "HIGH RISK",
};

export function ScoreBadge({
  score,
  verdict,
  size = "lg",
}: {
  score: number;
  verdict: Verdict;
  size?: "sm" | "lg";
}) {
  const color = VERDICT_COLORS[verdict];
  const label = VERDICT_LABELS[verdict];

  if (size === "sm") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="font-mono font-bold text-lg"
          style={{ color }}
          aria-label={`Score: ${score} out of 10, ${label}`}
        >
          {score.toFixed(1)}
        </span>
        <span
          className="text-xs font-mono px-1.5 py-0.5 rounded"
          style={{ color, borderColor: color, border: "1px solid" }}
        >
          {label}
        </span>
      </div>
    );
  }

  return (
    <div className="score-badge flex flex-col items-center gap-2" role="alert">
      <span
        className="font-mono font-bold text-5xl"
        style={{ color }}
        aria-label={`Score: ${score} out of 10`}
      >
        {score.toFixed(1)}
      </span>
      <span
        className="text-sm font-mono px-3 py-1 rounded"
        style={{ color, borderColor: color, border: "1px solid" }}
      >
        {label}
      </span>
    </div>
  );
}

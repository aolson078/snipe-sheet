"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type State = "redeeming" | "success" | "needs_login" | "error";

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<State>("redeeming");
  const [plan, setPlan] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function redeem() {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (res.status === 401) {
        // Not logged in — send to login, come back here after
        setState("needs_login");
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setPlan(data.plan);
        setState("success");
        setTimeout(() => router.push("/"), 3000);
        return;
      }

      const data = await res.json();
      setErrorMsg(data.error ?? "Something went wrong");
      setState("error");
    }

    redeem();
  }, [code, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] px-4 text-center">
      {state === "redeeming" && (
        <p className="font-mono text-[#71717a] animate-pulse">Redeeming invite...</p>
      )}

      {state === "success" && (
        <div className="space-y-4">
          <p className="font-mono text-2xl font-bold text-[#22c55e]">You&apos;re in.</p>
          <p className="font-mono text-[#a1a1aa]">
            Upgraded to <span className="text-white font-bold uppercase">{plan}</span>. Redirecting...
          </p>
        </div>
      )}

      {state === "needs_login" && (
        <div className="space-y-4">
          <p className="font-mono text-lg font-bold">Sign in to redeem your invite</p>
          <p className="font-mono text-[#71717a] text-sm">
            Your invite code <span className="text-white">{code}</span> is waiting.
          </p>
          <a
            href={`/login?callbackUrl=/invite/${code}`}
            className="inline-block px-6 py-3 bg-[#22c55e] text-[#0a0a0a] font-mono font-bold rounded hover:bg-[#16a34a] transition-colors"
          >
            Sign in
          </a>
        </div>
      )}

      {state === "error" && (
        <div className="space-y-4">
          <p className="font-mono text-[#ef4444]">{errorMsg}</p>
          <a href="/" className="font-mono text-sm text-[#71717a] hover:text-white">
            Go home
          </a>
        </div>
      )}
    </div>
  );
}

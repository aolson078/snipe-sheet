import type { Chain, ContractSafety } from "./types";

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";

const CHAIN_IDS: Record<Chain, string> = {
  ethereum: "1",
  base: "8453",
};

interface GoPlusResponse {
  code: number;
  result: Record<
    string,
    {
      is_mintable?: string;
      is_proxy?: string;
      is_honeypot?: string;
      is_blacklisted?: string;
      owner_address?: string;
      can_take_back_ownership?: string;
      lp_holders?: Array<{
        is_locked?: number;
        locked_detail?: Array<{ end_time?: string }>;
      }>;
    }
  >;
}

export async function fetchContractSafety(
  address: string,
  chain: Chain
): Promise<ContractSafety> {
  const chainId = CHAIN_IDS[chain];
  const url = `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${address.toLowerCase()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
  });

  if (response.status === 429) {
    throw new Error("GOPLUS_RATE_LIMITED");
  }

  if (!response.ok) {
    throw new Error(`GoPlus API error: ${response.status}`);
  }

  const data: GoPlusResponse = await response.json();
  const tokenData = data.result?.[address.toLowerCase()];

  if (!tokenData) {
    throw new Error("GoPlus returned no data for this token");
  }

  const isMintable = tokenData.is_mintable === "1";
  const isProxy = tokenData.is_proxy === "1";
  const isHoneypot = tokenData.is_honeypot === "1";
  const hasBlacklist = tokenData.is_blacklisted === "1";
  const ownershipRenounced =
    !tokenData.owner_address ||
    tokenData.owner_address === "0x0000000000000000000000000000000000000000";

  const lpHolder = tokenData.lp_holders?.[0];
  const lpLocked = lpHolder?.is_locked === 1;
  const lockEndTime = lpHolder?.locked_detail?.[0]?.end_time;
  const lpLockDurationDays = lockEndTime
    ? Math.max(
        0,
        (new Date(lockEndTime).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  // Score: 0-10
  // Critical red flags: mintable, honeypot → heavy penalty
  // Warnings: proxy, blacklist → moderate penalty
  // Positives: ownership renounced, LP locked → bonus
  let score = 5;

  if (isHoneypot) score -= 5;
  if (isMintable) score -= 3;
  if (isProxy) score -= 1;
  if (hasBlacklist) score -= 1;
  if (ownershipRenounced) score += 2;
  if (lpLocked) score += 2;
  if (lpLockDurationDays && lpLockDurationDays > 180) score += 1;

  score = Math.max(0, Math.min(10, score));

  return {
    isMintable,
    isProxy,
    isHoneypot,
    hasBlacklist,
    ownershipRenounced,
    lpLocked,
    lpLockDurationDays: lpLockDurationDays
      ? Math.round(lpLockDurationDays)
      : null,
    score,
  };
}

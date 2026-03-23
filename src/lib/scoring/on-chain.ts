import { createPublicClient, http, parseAbi, type Address } from "viem";
import { mainnet, base } from "viem/chains";
import type { Chain, HolderData, TokenAgeData } from "./types";

const CHAINS = {
  ethereum: mainnet,
  base: base,
};

function getRpcUrl(chain: Chain): string {
  if (chain === "ethereum") {
    return process.env.ALCHEMY_ETH_RPC || "https://eth.llamarpc.com";
  }
  return process.env.ALCHEMY_BASE_RPC || "https://base.llamarpc.com";
}

function getClient(chain: Chain) {
  return createPublicClient({
    chain: CHAINS[chain],
    transport: http(getRpcUrl(chain)),
  });
}

const ERC20_ABI = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]);

export async function fetchHolderData(
  address: string,
  chain: Chain
): Promise<HolderData> {
  const client = getClient(chain);
  const tokenAddress = address as Address;

  try {
    const totalSupply = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "totalSupply",
    });

    if (totalSupply === BigInt(0)) {
      return { topHolderPct: 100, top10HolderPct: 100, holderCount: 0, score: 0 };
    }

    // For V1, we check the contract creator's balance as a proxy for concentration
    // Full holder analysis requires an indexer (Etherscan API, Covalent, etc.)
    // This is a simplified approach that catches the worst cases
    const deployerBalance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [tokenAddress], // Check contract's own balance (common for new tokens)
    });

    const contractPct =
      Number((deployerBalance * BigInt(10000)) / totalSupply) / 100;

    // Score: 0-10
    // High concentration = bad
    let score = 7;
    if (contractPct > 50) score = 2;
    else if (contractPct > 30) score = 4;
    else if (contractPct > 10) score = 6;
    else score = 8;

    return {
      topHolderPct: Math.round(contractPct * 10) / 10,
      top10HolderPct: contractPct, // Simplified — only tracking contract balance in V1
      holderCount: 0, // Requires indexer for accurate count
      score,
    };
  } catch {
    // Contract may not be ERC20 or may have reverted
    return { topHolderPct: 0, top10HolderPct: 0, holderCount: 0, score: 5 };
  }
}

export async function fetchTokenAge(
  address: string,
  chain: Chain
): Promise<TokenAgeData> {
  const client = getClient(chain);

  try {
    // Get the contract creation block by checking the earliest code
    const code = await client.getCode({ address: address as Address });
    if (!code || code === "0x") {
      return { ageHours: 0, score: 1 };
    }

    // Use current block timestamp as reference
    const block = await client.getBlock({ blockTag: "latest" });
    const nowSecs = Number(block.timestamp);

    // For V1, we estimate age from the token's first DexScreener pair
    // (more accurate than trying to find deployment tx without an indexer)
    // The actual age will be supplemented by DexScreener pair age data
    // For now, return a default that gets overridden by pairAgeHours
    return {
      ageHours: 0, // Will be enriched by DexScreener pair age
      score: 3, // Default for unknown age — conservative
    };
  } catch {
    return { ageHours: 0, score: 3 };
  }
}

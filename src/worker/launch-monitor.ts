import { createPublicClient, http, parseAbiItem, type Log } from "viem";
import { mainnet, base } from "viem/chains";
import { createRedisClient } from "../lib/redis";
import { enqueueScore } from "./queue";
import type { Chain } from "../lib/scoring/types";

// ── Launch Monitor ─────────────────────────────────
//
//  Polls Uniswap V2/V3 and Aerodrome factory contracts for
//  PairCreated events. Each new pair triggers a scoring job.
//
//  Safety model:
//  - Block cursor: persists last processed block in Redis
//  - Idempotent: dedup by event tx hash
//  - Reorg safety: 2-block confirmation delay
//

const FACTORIES: { chain: Chain; address: `0x${string}`; name: string }[] = [
  {
    chain: "ethereum",
    address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", // Uniswap V2
    name: "Uniswap V2",
  },
  {
    chain: "base",
    address: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6", // Aerodrome
    name: "Aerodrome",
  },
];

const PAIR_CREATED_EVENT = parseAbiItem(
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
);

const POLL_INTERVAL_MS = 15_000; // 15 seconds
const REORG_SAFETY_BLOCKS = 2;

const redis = createRedisClient();

function getClient(chain: Chain) {
  const rpcUrl =
    chain === "ethereum"
      ? process.env.ALCHEMY_ETH_RPC || "https://eth.llamarpc.com"
      : process.env.ALCHEMY_BASE_RPC || "https://base.llamarpc.com";

  return createPublicClient({
    chain: chain === "ethereum" ? mainnet : base,
    transport: http(rpcUrl),
  });
}

async function getBlockCursor(chain: Chain, factory: string): Promise<bigint> {
  const key = `launch-monitor:cursor:${chain}:${factory}`;
  const stored = await redis.get(key);
  if (stored) return BigInt(stored);

  // First run: start from current block minus a small window
  const client = getClient(chain);
  const block = await client.getBlockNumber();
  const start = block - BigInt(100); // ~25 minutes of history
  await redis.set(key, start.toString());
  return start;
}

async function setBlockCursor(
  chain: Chain,
  factory: string,
  block: bigint
): Promise<void> {
  const key = `launch-monitor:cursor:${chain}:${factory}`;
  await redis.set(key, block.toString());
}

async function isEventProcessed(txHash: string): Promise<boolean> {
  const key = `launch-monitor:seen:${txHash}`;
  const result = await redis.set(key, "1", "EX", 86400, "NX"); // 24h TTL
  return result === null; // null means key already existed
}

async function pollFactory(
  chain: Chain,
  factoryAddress: `0x${string}`,
  factoryName: string
): Promise<void> {
  const client = getClient(chain);

  try {
    const currentBlock = await client.getBlockNumber();
    const safeBlock = currentBlock - BigInt(REORG_SAFETY_BLOCKS);
    const fromBlock = await getBlockCursor(chain, factoryAddress);

    if (fromBlock >= safeBlock) return; // Up to date

    // Cap range to avoid huge queries
    const maxRange = BigInt(1000);
    const toBlock =
      safeBlock - fromBlock > maxRange ? fromBlock + maxRange : safeBlock;

    const logs: Log[] = await client.getLogs({
      address: factoryAddress,
      event: PAIR_CREATED_EVENT,
      fromBlock,
      toBlock,
    });

    for (const log of logs) {
      const txHash = log.transactionHash;
      if (!txHash) continue;

      // Idempotent: skip if already processed
      if (await isEventProcessed(txHash)) continue;

      const token0 = log.args?.token0 as string | undefined;
      const token1 = log.args?.token1 as string | undefined;

      // WETH / WBASE addresses — the "quote" side of pairs
      const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
      const WBASE = "0x4200000000000000000000000000000000000006";
      const stables = [WETH, WBASE].map((a) => a.toLowerCase());

      // Score the non-WETH/non-WBASE token
      let tokenAddress: string | undefined;
      if (token0 && stables.includes(token0.toLowerCase())) {
        tokenAddress = token1;
      } else if (token1 && stables.includes(token1.toLowerCase())) {
        tokenAddress = token0;
      } else {
        // Neither is WETH — score both? For V1, score token0
        tokenAddress = token0;
      }

      if (tokenAddress) {
        console.log(
          `[launch-monitor] New pair on ${factoryName}: ${tokenAddress}`
        );
        await enqueueScore({
          address: tokenAddress,
          chain,
          source: "launch_monitor",
        });
      }
    }

    // Advance cursor
    await setBlockCursor(chain, factoryAddress, toBlock);

    if (logs.length > 0) {
      console.log(
        `[launch-monitor] ${factoryName}: processed ${logs.length} events (block ${fromBlock}→${toBlock})`
      );
    }
  } catch (err) {
    console.error(`[launch-monitor] ${factoryName} error:`, err);
    // Don't advance cursor on error — retry next poll
  }
}

export function startLaunchMonitor(): NodeJS.Timeout {
  console.log(
    `[launch-monitor] Started (polling every ${POLL_INTERVAL_MS / 1000}s, ${FACTORIES.length} factories)`
  );

  async function poll() {
    for (const factory of FACTORIES) {
      await pollFactory(factory.chain, factory.address, factory.name);
    }
  }

  // Initial poll
  poll();

  // Recurring poll
  return setInterval(poll, POLL_INTERVAL_MS);
}

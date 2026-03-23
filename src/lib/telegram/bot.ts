import { Bot } from "grammy";
import { enqueueScore } from "../../worker/queue";
import { db } from "../db/client";
import { tokens, tokenScores } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { checkTelegramRateLimit } from "../rate-limit";
import type { Chain } from "../scoring/types";

const VERDICT_EMOJI: Record<string, string> = {
  low_risk: "\u{1F7E2}",  // green circle
  caution: "\u{1F7E1}",   // yellow circle
  high_risk: "\u{1F534}",  // red circle
};

export function createBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN required");

  const bot = new Bot(token);

  bot.command("start", (ctx) =>
    ctx.reply(
      "Welcome to Snipe Sheet!\n\n" +
        "Paste a token address to check it:\n" +
        "/check 0x... [ethereum|base]\n\n" +
        "Free: 5 checks/day. Upgrade at snipesheet.xyz"
    )
  );

  bot.command("check", async (ctx) => {
    const args = ctx.match?.split(/\s+/) ?? [];
    const address = args[0];
    const chain: Chain = (args[1] as Chain) || "ethereum";

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return ctx.reply("Invalid address. Usage: /check 0x... [ethereum|base]");
    }

    if (!["ethereum", "base"].includes(chain)) {
      return ctx.reply("Unsupported chain. Use: ethereum or base");
    }

    // Rate limit by chat_id
    const chatId = ctx.chat?.id?.toString() ?? "unknown";
    const rateCheck = await checkTelegramRateLimit(chatId);
    if (!rateCheck.allowed) {
      return ctx.reply(
        "Limit reached (5/day). Upgrade at snipesheet.xyz for unlimited."
      );
    }

    await ctx.reply(`Analyzing ${address.slice(0, 10)}... on ${chain}`);

    // Enqueue scoring job
    await enqueueScore({ address, chain, source: "user" });

    // Poll for result (up to 30 seconds)
    const normalizedAddress = address.toLowerCase();
    let attempts = 0;
    const maxAttempts = 15;

    const poll = async (): Promise<void> => {
      const token = await db.query.tokens.findFirst({
        where: and(
          eq(tokens.address, normalizedAddress),
          eq(tokens.chain, chain)
        ),
      });

      if (token) {
        const score = await db.query.tokenScores.findFirst({
          where: eq(tokenScores.tokenId, token.id),
          orderBy: [desc(tokenScores.scoredAt)],
        });

        if (score) {
          const emoji = VERDICT_EMOJI[score.verdict] ?? "";
          const partial =
            !score.goplusAvailable || !score.socialAvailable
              ? "\n\u26A0\uFE0F Partial score — some data unavailable"
              : "";

          await ctx.reply(
            `${emoji} ${parseFloat(score.score).toFixed(1)} ${score.verdict.toUpperCase().replace("_", " ")}\n\n` +
              `${score.summary ?? ""}${partial}\n\n` +
              `Full analysis: ${process.env.NEXT_PUBLIC_APP_URL}/token/${normalizedAddress}/${chain}`
          );
          return;
        }
      }

      attempts++;
      if (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        return poll();
      }

      await ctx.reply(
        "Scoring is taking longer than expected. Check the result at:\n" +
          `${process.env.NEXT_PUBLIC_APP_URL}/token/${normalizedAddress}/${chain}`
      );
    };

    await poll();
  });

  return bot;
}

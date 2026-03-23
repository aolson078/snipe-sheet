import { NextRequest, NextResponse } from "next/server";
import { createBot } from "@/lib/telegram/bot";
import { webhookCallback } from "grammy";

let handler: ReturnType<typeof webhookCallback> | null = null;

function getHandler() {
  if (!handler) {
    const bot = createBot();
    handler = webhookCallback(bot, "std/http");
  }
  return handler;
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cb = getHandler();
    return await cb(request);
  } catch (err) {
    console.error("[telegram] Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

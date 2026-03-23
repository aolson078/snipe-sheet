import { NextRequest, NextResponse } from "next/server";
import { createBot } from "@/lib/telegram/bot";
import { webhookCallback } from "grammy";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let handler: ((req: Request) => Promise<Response>) | null = null;

function getHandler() {
  if (!handler) {
    const bot = createBot();
    // Cast to align grammy's webhook handler with Web API Request/Response
    handler = webhookCallback(bot, "std/http") as unknown as (
      req: Request
    ) => Promise<Response>;
  }
  return handler;
}

export async function POST(request: NextRequest) {
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

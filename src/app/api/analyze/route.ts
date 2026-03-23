import { NextRequest, NextResponse } from "next/server";
import { analyzeSchema } from "@/lib/validate";
import { enqueueScore } from "@/worker/queue";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = analyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { address, chain } = parsed.data;

    // TODO: Add auth + rate limit check here once NextAuth is wired up
    // For now, allow all requests during development

    const jobId = await enqueueScore({
      address,
      chain,
      source: "user",
    });

    return NextResponse.json({ jobId, status: "queued" });
  } catch (err) {
    console.error("[api/analyze] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

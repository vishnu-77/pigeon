import { NextResponse } from "next/server";
import { POST as runInternalDemo } from "../run/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let input: { scenario?: string; mode?: string; encryptedMessage?: string } = {};

  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ live: false, error: "The demo request could not be processed." }, { status: 400 });
  }

  const forwarded = new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });

  try {
    const response = await runInternalDemo(forwarded);
    const payload = await response.json();

    if (!response.ok || !payload?.live) {
      return NextResponse.json(
        {
          live: false,
          error: response.status >= 500 ? "The live demo is temporarily unavailable. Please try again." : "The demo request could not be processed."
        },
        { status: response.status >= 500 ? 503 : 400 }
      );
    }

    return NextResponse.json({
      live: true,
      decision: payload.decision,
      elapsedMs: payload.elapsedMs,
      gates: Array.isArray(payload.gates) ? payload.gates.map((gate: { name?: string; pass?: boolean }) => ({ name: gate.name, pass: Boolean(gate.pass) })) : [],
      receiver: {
        receivedCount: payload?.receiver?.receivedCount ?? 0,
        delivered: payload?.receiver?.delivered ?? []
      }
    });
  } catch {
    return NextResponse.json({ live: false, error: "The live demo is temporarily unavailable. Please try again." }, { status: 503 });
  }
}

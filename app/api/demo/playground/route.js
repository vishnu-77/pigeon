import { runPlayground, validatePlayground } from "../../../../lib/demo-playground.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return Response.json({ error: "Keep the complete request under 8,192 characters." }, { status: 413 });
    input = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Enter a valid JSON message." }, { status: 400 });
  }
  const invalid = validatePlayground(input);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  try {
    return Response.json(runPlayground(input), { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "The playground could not complete this run. Please try again." }, { status: 500 });
  }
}

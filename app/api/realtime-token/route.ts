import { createDecartClient } from "@decartai/sdk";

export const dynamic = "force-dynamic";
// Token creation normally completes quickly. A short ceiling prevents a stuck
// upstream request from consuming function time for Vercel's 300-second default.
export const maxDuration = 5;

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");

  if (requestOrigin && requestOrigin !== requestUrl.origin) {
    return Response.json({ error: "Cross-origin token requests are not allowed." }, { status: 403 });
  }

  const apiKey = process.env.DECART_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Live AI is not configured yet. Add DECART_API_KEY on the server." },
      { status: 503 },
    );
  }

  try {
    const serverClient = createDecartClient({ apiKey });
    const token = await serverClient.tokens.create({
      expiresIn: 60,
      allowedModels: ["lucy-vton-3.6"],
      allowedOrigins: [requestUrl.origin],
      constraints: { realtime: { maxSessionDuration: 35 } },
      metadata: { experience: "the-figure-demo" },
    });

    return Response.json(
      { apiKey: token.apiKey, expiresAt: token.expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to mint Decart client token", error);
    return Response.json(
      { error: "The AI fitting room is temporarily unavailable." },
      { status: 502 },
    );
  }
}

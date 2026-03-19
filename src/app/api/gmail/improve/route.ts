import { NextRequest } from "next/server";
import { getAccessToken, AuthTokenExpiredError } from "@/lib/auth";
import { getOpenAIClient } from "@/lib/claude";

/**
 * POST /api/gmail/improve
 * Body: { body: string, context?: string }
 * Returns: { improved: string }
 *
 * Uses GPT to improve email text for clarity and professionalism.
 */
export async function POST(request: NextRequest) {
  try {
    await getAccessToken(); // Ensure user is authenticated
    const { body, context } = await request.json();

    if (!body || typeof body !== "string") {
      return new Response(
        JSON.stringify({ error: "body string is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const openai = getOpenAIClient();

    const systemPrompt = `You are an email writing assistant. Improve the given email for clarity, professionalism, and readability. Keep the same intent, tone direction, and approximate length. Return only the improved email text, nothing else. Do not add a subject line — only improve the body.${context ? `\n\nContext: ${context}` : ""}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: body },
      ],
      max_completion_tokens: 1000,
    });

    const improved = response.choices[0]?.message?.content?.trim() ?? body;

    return new Response(
      JSON.stringify({ improved }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    if (error instanceof AuthTokenExpiredError) {
      return new Response(
        JSON.stringify({ error: "token_expired" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("POST /api/gmail/improve error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to improve email" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

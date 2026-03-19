import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/conversations — List user's conversations (most recent first)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId: session.user.email },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return new Response(JSON.stringify({ conversations }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GET /api/conversations error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch conversations" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * POST /api/conversations — Create a new conversation
 * Body: { title?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const title = body.title || "New conversation";

    const conversation = await prisma.conversation.create({
      data: {
        title,
        userId: session.user.email,
      },
    });

    return new Response(JSON.stringify({ conversation }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("POST /api/conversations error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create conversation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/conversations/[id] — Fetch conversation with messages
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { id } = await params;

    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: session.user.email },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(conversation), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("GET /api/conversations/[id] error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch conversation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * DELETE /api/conversations/[id] — Delete a conversation
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { id } = await params;

    // Verify ownership
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId: session.user.email },
    });

    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    await prisma.conversation.delete({ where: { id } });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("DELETE /api/conversations/[id] error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete conversation" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

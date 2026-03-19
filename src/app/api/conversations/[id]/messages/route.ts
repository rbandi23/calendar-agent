import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/conversations/[id]/messages — Save a message to a conversation
 * Body: { role: string, content: string, toolCalls?: any[], structuredBlocks?: any[] }
 */
export async function POST(
  request: NextRequest,
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

    const body = await request.json();
    const { role, content, toolCalls, structuredBlocks } = body;

    if (!role || !content) {
      return new Response(
        JSON.stringify({ error: "role and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const message = await prisma.message.create({
      data: {
        role,
        content,
        toolCalls: toolCalls ?? undefined,
        structuredBlocks: structuredBlocks ?? undefined,
        conversationId: id,
      },
    });

    // Update conversation title from first user message if still default
    if (role === "user" && conversation.title === "New conversation") {
      const title = content.slice(0, 100);
      await prisma.conversation.update({
        where: { id },
        data: { title },
      });
    }

    // Touch updatedAt
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return new Response(JSON.stringify({ message }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("POST /api/conversations/[id]/messages error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to save message" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

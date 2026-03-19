import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Debug endpoint — remove after fixing auth.
 * GET /api/debug-auth
 */
export async function GET(request: NextRequest) {
  const session = await auth();

  // Check which env vars are set (values hidden)
  const envCheck = {
    AUTH_SECRET: !!process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL ?? "NOT SET",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "NOT SET",
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  };

  // Check cookies
  const cookieNames = request.cookies.getAll().map((c) => c.name);

  return NextResponse.json({
    hasSession: !!session,
    sessionUser: session?.user?.email ?? null,
    sessionError: session?.error ?? null,
    envCheck,
    cookies: cookieNames,
  });
}

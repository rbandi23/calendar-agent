import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getToken } from "next-auth/jwt";
import { headers, cookies } from "next/headers";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/contacts.readonly",
          ].join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist Google tokens inside the encrypted JWT
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }

      // Token still valid (60s buffer)
      if (
        token.expiresAt &&
        Date.now() < token.expiresAt * 1000 - 60_000
      ) {
        return token;
      }

      // Token expired — refresh via Google
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken!,
          }),
        });

        const refreshed = await response.json();
        if (!response.ok) throw new Error("Failed to refresh token");

        token.accessToken = refreshed.access_token;
        token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in;
        if (refreshed.refresh_token) {
          token.refreshToken = refreshed.refresh_token;
        }
        return token;
      } catch {
        token.error = "RefreshTokenError";
        return token;
      }
    },
    async session({ session, token }) {
      // Only expose user info + error flag to the client — NO tokens
      if (token.error) {
        session.error = token.error;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});

/**
 * Thrown when the access token exists but is expired and refresh failed.
 * Distinguished from "Not authenticated" (no token at all) so callers
 * can prompt reauthorization instead of a generic sign-in.
 */
export class AuthTokenExpiredError extends Error {
  constructor() {
    super("Token expired — please reauthorize");
    this.name = "AuthTokenExpiredError";
  }
}

/**
 * Server-only: read the raw JWT from the request cookie and return the
 * Google access token. Uses getToken() which decodes the Auth.js JWT
 * without going through the session() shape, so hidden fields like
 * accessToken and refreshToken are available.
 *
 * Call this from API route handlers only.
 */
export async function getAccessToken(): Promise<string> {
  // Build a minimal Request-like object from Next.js headers/cookies
  // so getToken() can find and decode the Auth.js JWT cookie.
  const headersList = await headers();
  const cookieStore = await cookies();
  const req = {
    headers: headersList,
    cookies: cookieStore,
  };

  const token = await getToken({
    req: req as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  });

  if (!token?.accessToken) {
    throw new Error("Not authenticated");
  }

  // Token refresh failed — the access token is stale/expired
  if (token.error === "RefreshTokenError") {
    throw new AuthTokenExpiredError();
  }

  return token.accessToken;
}

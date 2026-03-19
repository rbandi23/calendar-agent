# Calendar Agent

## Overview
Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + PostgreSQL/Prisma AI-powered calendar assistant with Gmail and Google Calendar integration.

## Architecture
- **3-panel layout**: Sidebar (nav + conversations) | Center (Calendar/Chat/Analytics) | Context Panel (event details, draft editor)
- **All Google API calls** happen in API routes (`src/app/api/*`). Frontend calls `/api/*` — never calls Google APIs directly.
- **Auth**: NextAuth v5 with Google OAuth. Tokens stored in encrypted JWT, never exposed to the client.
- **AI**: OpenAI GPT-5-mini via agentic tool-calling loop. Chat uses SSE streaming.
- **Database**: PostgreSQL via Prisma for chat persistence (conversations + messages).

## Security Rules
- **Tokens are server-only.** Always use `getAccessToken()` in API routes. Never expose access tokens to the client.
- **Agent must NEVER send emails or create real Gmail drafts autonomously.** Always use `propose_email` tool to propose drafts for user approval. Users send from the UI.
- Validate inputs at API boundaries. Return proper HTTP status codes.

## Key Patterns

### API Route Pattern
```ts
export async function GET(request: NextRequest) {
  const accessToken = await getAccessToken(); // throws if unauthenticated
  // ... use accessToken with Google service functions
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}
```

### Chat
- Sliding window of 10 messages sent to GPT
- SSE streaming: `tool_call`, `tool_result`, `text`, `done` event types
- Structured blocks in `:::type json:::` format for rich UI (timeslots, draft, analytics, meetingprep)
- Tool calls rendered as collapsible status cards in message bubbles

### Database
- Prisma + PostgreSQL. Schema in `prisma/schema.prisma`.
- Run `npx prisma migrate dev` after schema changes.
- Run `npx prisma generate` after pulling.

## Commands
- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm test` — Run Jest test suite
- `npx prisma migrate dev` — Run database migrations
- `npx prisma generate` — Generate Prisma client

## Code Style
- TypeScript strict mode. No `any` types.
- Use existing shadcn/ui components (`src/components/ui/*`). Add new ones via `npx shadcn@latest add <component>`.
- Tailwind v4 for all styling. Dark mode forced via `className="dark"` on `<html>`.
- Prefer `date-fns` for date manipulation.
- Keep AI responses concise — bullet points, max 2-3 short paragraphs.

## Testing
- Jest + Testing Library for unit and integration tests.
- Tests in `src/__tests__/`. Run `npm test` before committing.
- Mock Google APIs and OpenAI in tests. Use `jest.mock()` for service modules.
- Maintain test coverage for: services (`lib/*`), hooks, API routes, key components.

## File Structure
```
src/
├── app/api/          # API routes (calendar, chat, gmail, contacts, analytics, conversations)
├── components/       # React components (calendar, chat, context, layout, settings, ui)
├── context/          # React contexts (panel, preferences)
├── hooks/            # Custom hooks (use-chat)
├── lib/              # Service functions (calendar, gmail, contacts, analytics, meeting-prep, auth, prisma)
├── types/            # TypeScript type definitions
└── __tests__/        # Test files
```

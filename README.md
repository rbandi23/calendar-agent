# Calendar Agent

An AI-powered calendar assistant that connects to Google Calendar and Gmail, letting you manage your schedule, draft emails, and prep for meetings through natural conversation.

Built with Next.js 16, React 19, OpenAI GPT-5-mini, and a 3-panel layout inspired by modern productivity tools.

<!--
  Screenshots: Take these from your running app and place in docs/screenshots/
  Recommended: Use Chrome DevTools device toolbar at 1440x900 for consistency
-->

![Dashboard — Calendar + Chat + Context Panel](docs/screenshots/dashboard-full.png)

---

## Features

### Conversational Calendar Management
Talk to your calendar in plain English. The AI agent chains multiple tools together to handle complex requests.

> "Move my 3pm to tomorrow and email the attendees about the change"

The agent will: look up the event → check tomorrow's availability → reschedule it → draft a notification email for your approval.

![Chat with agentic tool-calling](docs/screenshots/chat-tools.png)

### What the Agent Can Do

| Capability | How It Works |
|------------|-------------|
| **View & search events** | "What's on my calendar this week?" |
| **Create events** | "Schedule a 30-min call with Sarah tomorrow at 2pm" |
| **Reschedule events** | "Move my standup to 10am" — preserves duration, notifies attendees |
| **Cancel events** | "Cancel the team sync on Friday" — confirms before deleting |
| **Check availability** | "When are both Sarah and I free this week?" |
| **Draft emails** | "Email the team asking if they're free Friday" — renders an editable card |
| **Send separate emails** | "Send each of them an individual email" — one card per recipient |
| **Search emails** | "Find emails from Sarah about the Q3 roadmap" |
| **Meeting prep** | "Prep me for my next meeting" — pulls attendee email history |
| **Calendar analytics** | "How does my week look?" — charts, focus time, recommendations |
| **Voice input** | Click the mic and speak your request (Chrome/Edge) |

### 3-Panel Layout

```
 Sidebar  |     Calendar      |   Chat   | Context Panel
  (64px)  |    (flex-1)       |  (420px) |   (320px)
          |                   |          |
  [Logo]  |  [Week/Month]     | Messages | Event details
  [Cal]   |  [FullCalendar]   | Tool viz | Email drafts
  [Chat]  |                   | Input    | Attendees
  [Set]   |                   | Mic/Send |
```

- **Calendar**: FullCalendar with week/month views, color-coded events, drag-to-chat
- **Chat**: SSE-streamed responses, collapsible tool reasoning, structured response cards
- **Context Panel**: Opens on the right when you click an event or book a time slot

![Event details in context panel](docs/screenshots/context-panel.png)

### Agentic Tool Visualization

The chat shows what the AI is doing in real-time with a collapsible timeline:

- Tool-specific icons (calendar, email, contacts)
- Parallel execution detection ("parallel" label when tools run simultaneously)
- Rich summaries ("Found 5 events", "3 busy blocks", "Draft: Q3 Planning")
- Duration badges per tool call
- Auto-expands while thinking, collapses when done

![Tool reasoning visualization](docs/screenshots/tool-viz.png)

### Drag Events to Chat

Drag any calendar event into the chat input to reference it in your message. The event appears as a chip, and the context is sent to the AI.

![Drag event to chat](docs/screenshots/drag-to-chat.png)

### Interactive Email Drafts

When the AI drafts an email, it renders as an editable card — not plain text. You can modify the To, Subject, and Body fields, improve the draft with AI, then send directly from the card.

![Email draft card](docs/screenshots/email-draft.png)

### Voice Input

Click the mic button to speak your request. The transcript appears in real-time and auto-sends after you stop speaking. Works in Chrome and Edge.

### Calendar Auto-Refresh

When the AI creates, reschedules, or cancels an event, the calendar refreshes automatically. A manual refresh button is also available in the toolbar.

---

## Architecture

```
Browser                          Server (Next.js API Routes)           External
  |                                    |                                  |
  |  /api/chat (SSE stream)           |                                  |
  |  ──────────────────────>          |                                  |
  |                                    |  OpenAI GPT-5-mini               |
  |                                    |  ──────────────────>             |
  |                                    |  <── tool_calls                  |
  |  <── tool_call event              |                                  |
  |  <── tool_result event            |  Google Calendar API             |
  |                                    |  ──────────────────>             |
  |  <── text (token stream)          |  Google Gmail API                |
  |  <── structured_block             |  Google Contacts API             |
  |  <── done                         |                                  |
  |                                    |                                  |
  |  /api/conversations (REST)        |  PostgreSQL (Prisma)             |
  |  ──────────────────────>          |  ──────────────────>             |
```

### Key Design Decisions

- **All Google API calls happen server-side.** Tokens are never exposed to the browser. API routes use `getAccessToken()` from encrypted JWT sessions.
- **Agent never sends emails autonomously.** The `propose_email` tool returns a structured block that renders an editable card. Users send from the UI.
- **Agentic tool-calling loop** supports up to 10 rounds with parallel tool execution. Non-streaming for tool rounds, SSE streaming for the final response.
- **Conversation persistence** — auto-creates a DB conversation on the first message, saves all messages with tool calls and structured blocks.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1 (Turbopack) |
| UI | React 19, Tailwind v4, shadcn/ui (base-ui) |
| AI | OpenAI GPT-5-mini, agentic tool-calling |
| Calendar | FullCalendar 6 (week/month, drag-and-drop) |
| Charts | Recharts 3 |
| Database | PostgreSQL + Prisma 7 |
| Auth | NextAuth v5 (Google OAuth) |
| Dates | date-fns 4 |

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or hosted — [Prisma Postgres](https://www.prisma.io/postgres), [Neon](https://neon.tech), [Supabase](https://supabase.com))
- Google Cloud project with Calendar, Gmail, and People APIs enabled
- OpenAI API key

### 1. Clone and install

```bash
git clone <your-repo-url>
cd calendar-agent
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# NextAuth
NEXTAUTH_SECRET="openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI
OPENAI_API_KEY="sk-..."
```

### 3. Set up the database

```bash
npx prisma generate    # Generate Prisma client (required after install)
npx prisma db push     # Push schema to database
```

### 4. Google Cloud setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable: **Google Calendar API**, **Gmail API**, **People API**
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Add scopes: `calendar`, `gmail.modify`, `gmail.send`, `contacts.readonly`

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with Google.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run Jest test suite (84 tests) |
| `npm run lint` | Run ESLint |
| `npx prisma generate` | Generate Prisma client (run after install) |
| `npx prisma db push` | Push schema to database |
| `npx prisma studio` | Open Prisma database browser |

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # Google OAuth
│   │   ├── calendar/             # CRUD + free/busy
│   │   ├── chat/                 # Agentic SSE streaming
│   │   ├── gmail/                # Search, send, drafts, improve
│   │   ├── contacts/             # Google Contacts search
│   │   ├── analytics/            # Calendar analytics
│   │   └── conversations/        # Chat persistence (CRUD + messages)
│   ├── dashboard/                # Main app (layout + calendar page)
│   └── auth/                     # Sign-in page
├── components/
│   ├── calendar/                 # FullCalendar wrapper
│   ├── chat/                     # Chat panel, message bubbles, input
│   │   └── structured-responses/ # TimeSlotCard, DraftPreview, AnalyticsChart, MeetingPrepCard
│   ├── context/                  # Event details, draft editor
│   ├── layout/                   # Sidebar, context panel
│   ├── settings/                 # Preferences dialog
│   └── ui/                       # shadcn/ui components
├── context/                      # React contexts (panel state, preferences)
├── hooks/                        # useChat (SSE + conversation management)
├── lib/
│   ├── chat-tools.ts             # 12 tool definitions + executor
│   ├── calendar-service.ts       # Google Calendar API wrapper
│   ├── gmail-service.ts          # Gmail API wrapper
│   ├── contacts-service.ts       # People API wrapper
│   ├── analytics.ts              # Meeting analytics computation
│   ├── meeting-prep.ts           # Meeting context aggregator
│   ├── auth.ts                   # NextAuth config + token helper
│   ├── claude.ts                 # OpenAI client singleton
│   ├── google.ts                 # Google API client factory
│   └── prisma.ts                 # Prisma client singleton
├── types/                        # TypeScript interfaces
└── __tests__/                    # Jest tests (API, hooks, components, services)
```

---

## AI Agent Tools (12 total)

| Tool | Description |
|------|-------------|
| `list_calendar_events` | Fetch events in a date range |
| `get_event_details` | Get full event info by ID |
| `create_calendar_event` | Create event with attendees, location |
| `reschedule_event` | Move event to new time (preserves duration) |
| `cancel_event` | Delete event, notify attendees |
| `get_free_busy` | Check availability for multiple people |
| `search_emails` | Search Gmail with full query syntax |
| `propose_email` | Draft email as interactive card (never sends autonomously) |
| `search_contacts` | Search Google Contacts by name/email |
| `analyze_meeting_time` | Calendar analytics with recommendations |
| `get_user_preferences` | Load user's work hours, buffer settings |
| `prep_for_meeting` | Aggregate attendee email history + event context |

---

## Security

- **Tokens are server-only.** Access tokens live in encrypted JWT sessions and are only used in API routes. Never sent to the browser.
- **Agent cannot send emails.** The `propose_email` tool renders a draft card. Users must click Send explicitly.
- **Conversation ownership.** All DB queries filter by `userId`. Users can only see/delete their own conversations.
- **Input validation.** API routes validate required fields and return proper HTTP status codes.
- **OAuth scopes.** Only requests the minimum scopes needed (calendar, gmail.modify, contacts.readonly).

---

## Testing

```bash
npm test
```

84 tests across 13 test suites covering:
- **API routes**: Calendar, chat, Gmail, conversations (full lifecycle)
- **Services**: Calendar service, Gmail service, contacts, analytics, chat tools
- **Hooks**: useChat (SSE parsing, message management)
- **Components**: CalendarView, ChatView, EventDetails

---

## Screenshots Needed

To add screenshots to this README, take them from your running app and save to `docs/screenshots/`:

| Filename | What to capture |
|----------|----------------|
| `dashboard-full.png` | Full 3-panel layout (calendar + chat + context panel open) |
| `chat-tools.png` | Chat showing the agentic tool visualization (expanded) |
| `context-panel.png` | Context panel showing event details with attendees |
| `drag-to-chat.png` | Mid-drag of a calendar event toward the chat input |
| `email-draft.png` | DraftPreview card in the chat with To/Subject/Body |
| `tool-viz.png` | Close-up of the tool reasoning timeline |
| `analytics.png` | Analytics chart with meeting stats |
| `voice-input.png` | Chat input with mic button active (red pulsing) |

Quick way to capture: open the app at `localhost:3000/dashboard`, use Chrome DevTools (Cmd+Shift+P → "Capture screenshot") at 1440x900.

---

## License

Private project.

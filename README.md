# Autonomous Dashboard

> **KI-Agenten-Orchestrierungssystem** — A Next.js control panel for a fully autonomous, self-evolving AI engine. Orchestrates multi-agent swarms across 300+ OpenRouter models, persists state in Supabase, streams results live, and notifies via Telegram.

---

## ✨ Key Features

- **5-Core Autonomous Engine** — Autopilot, Agentic Dev, Ralph Loop, AI Workflow, and Revenue cores run in parallel, with checkpoint-based crash recovery
- **300+ AI Models via OpenRouter** — Streaming chat, model browser with search/filter/pricing, and live credit-usage tracking
- **Multi-Agent Fleet** — Orchestrates Claude CLI, Gemini CLI, and OpenClaw gateway in coordinated pipelines
- **Ultra Autonomous Evolve & Earn** — End-to-end pipeline: market research → validation → planning → code generation → Vercel deploy → monetisation
- **Agent Swarm & Niche Hunter** — Self-evolving agent hive that discovers AI capability gaps and builds micro-SaaS solutions autonomously
- **Proactive Intelligence** — Engine self-analyses, surfaces required API keys, revenue opportunities, and improvement suggestions
- **Supabase Integration** — Persistent storage for agent state, logs, and vault data
- **Telegram Integration** — Bot-based notifications and remote control
- **Smart Router** — Automatically selects the best model for a task based on cost/capability trade-offs
- **Symbiotic Execution View** — Real-time orchestration feed with progress tracking and auto-resume on restart
- **Vault** — Encrypted local API key management (keys never committed to git)
- **Custom Dark Theme** — Tailwind CSS v4 with CSS-variable design tokens, no external UI library

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 + CSS Variables |
| AI Gateway | OpenRouter (300+ models, streaming SSE) |
| AI Agents | Claude CLI · Gemini CLI · OpenClaw |
| Database | Supabase (PostgreSQL) |
| Notifications | Telegram Bot API |
| Runtime | Node.js 20 |
| Package Manager | npm / pnpm |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **npm** or **pnpm**
- An [OpenRouter](https://openrouter.ai/keys) API key
- A [Supabase](https://app.supabase.com) project (free tier works)
- *(Optional)* Claude CLI, Gemini CLI, OpenClaw installed and authenticated for local-agent features

### 1. Clone

```bash
git clone https://github.com/Hoodkitz/autonomous-dashboard.git
cd autonomous-dashboard
```

### 2. Install dependencies

```bash
npm install
# or
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values (see [Environment Variables](#-environment-variables) below).

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. (Optional) Production build

```bash
npm run build
npm run start
```

---

## 🔧 Environment Variables

Copy `.env.example` to `.env.local` and set these values. **Never commit `.env.local`.**

| Variable | Required | Description |
|---|:---:|---|
| `SUPABASE_URL` | ✅ | Project URL from Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | ✅ | Anon/public key from Supabase → Settings → API |
| `DATABASE_URL` | ✅ | Postgres connection string for direct DB access |
| `OPENROUTER_API_KEY` | ✅ | API key from [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENCLAW_GATEWAY_HOST` | ➖ | OpenClaw gateway host (default: `127.0.0.1`) |
| `OPENCLAW_GATEWAY_PORT` | ➖ | OpenClaw gateway port (default: `18789`) |
| `OPENCLAW_GATEWAY_TOKEN` | ➖ | Bearer token for the OpenClaw gateway |
| `PORT` | ➖ | Next.js server port (default: `3000`) |

---

## 🏗 Architecture

```
autonomous-dashboard/
├── app/
│   ├── page.tsx                     # Engine Control + Proactive Intelligence
│   ├── symbiosis/page.tsx           # Symbiotic Engine orchestration view
│   ├── chat/page.tsx                # Streaming agent chat (CLI + OpenRouter)
│   ├── models/page.tsx              # OpenRouter model browser
│   ├── swarm/page.tsx               # Agent Swarm & Niche Hunter
│   ├── revenue/page.tsx             # Revenue opportunities tracker
│   ├── tasks/page.tsx               # Task management
│   ├── skills/page.tsx              # Installed agent skills inventory
│   ├── vault/page.tsx               # API key vault
│   ├── logs/page.tsx                # Activity logs
│   ├── telegram/page.tsx            # Telegram bot configuration
│   ├── deploy/page.tsx              # Deployment tooling
│   ├── arena/page.tsx               # Model arena / benchmarking
│   ├── research/page.tsx            # AI-driven research pipeline
│   ├── finance/page.tsx             # Finance tracking
│   ├── guardian/page.tsx            # Watchdog / guardian agent
│   ├── components/
│   │   ├── sidebar.tsx              # Navigation + agent status
│   │   └── status-badge.tsx         # Status indicator
│   ├── lib/
│   │   ├── engine.ts                # State management (~/.autonomous-engine/)
│   │   ├── openrouter.ts            # OpenRouter API client (chat, models, usage)
│   │   ├── supabase.ts              # Supabase client
│   │   ├── orchestrator.ts          # Multi-agent orchestration logic
│   │   ├── smart-ai.ts              # Smart model router
│   │   ├── autonomous-pipeline.ts   # End-to-end autonomous pipeline
│   │   └── meta-prompt.ts           # AIXI-inspired self-improving prompts
│   └── api/
│       ├── engine/                  # Engine state, control, execute, proactive, auto-resume
│       ├── agent/                   # Single-agent run, orchestrate, evolve
│       ├── openrouter/              # Chat, models, usage
│       ├── swarm/                   # Swarm + niche hunter
│       ├── telegram/                # Telegram webhook
│       ├── smart-router/            # Model selection
│       ├── vault/                   # Key management
│       ├── pipeline/                # Autonomous pipeline
│       ├── money-machine/           # Evolve & Earn pipeline
│       ├── research/                # Research pipeline
│       ├── revenue/                 # Revenue tracking
│       ├── deploy/                  # Deployment actions
│       └── ...
└── .env.example                     # Environment variable template
```

### How the Engine Works

1. **Engine Cores** — Five specialised cores (`autopilot`, `agentic_dev`, `ralph_loop`, `ai_agent_workflow`, `revenue_engine`) run concurrently. State is persisted to `~/.autonomous-engine/state.json` so work survives restarts.
2. **Agent Fleet** — API routes spawn Claude CLI, Gemini CLI, or OpenClaw as sub-processes; OpenRouter is called over HTTP. The Smart Router picks the right model automatically.
3. **Streaming** — All long-running responses use `ReadableStream` + NDJSON (newline-delimited JSON) so the UI updates in real time without polling.
4. **Vault** — API keys are stored locally in `~/.autonomous-engine/vault/keys.json`, never in git or the database.
5. **Auto-Resume** — On startup the dashboard calls `/api/engine/auto-resume` to detect interrupted work and surface a resume banner.

---

## 📱 Dashboard Pages

| Route | Description |
|---|---|
| `/` | Engine Control — start/stop/pause cores, proactive intelligence, money machine |
| `/symbiosis` | Real-time orchestration feed |
| `/chat` | Streaming chat with any OpenRouter model or local CLI agent |
| `/models` | Browse, search, and compare 300+ OpenRouter models |
| `/swarm` | Agent Swarm & Niche Hunter |
| `/revenue` | Revenue opportunities and tracking |
| `/tasks` | Task management |
| `/skills` | Installed agent skills |
| `/vault` | API key management |
| `/logs` | Activity and execution logs |
| `/research` | AI-driven research pipeline |
| `/finance` | Finance and self-funding tracking |
| `/deploy` | Deployment tools |
| `/arena` | Model benchmarking arena |
| `/telegram` | Telegram bot settings |
| `/guardian` | Watchdog / guardian agent |

---

## 📸 Screenshots

> _Screenshots coming soon._

---

## 🧪 CI

The project runs two checks on every push and pull request to `master`:

| Check | Command |
|---|---|
| TypeScript type-check | `npx tsc --noEmit` |
| ESLint | `npm run lint` |

---

## 📄 License

MIT © 2026 J. Paarmann — see [LICENSE](./LICENSE) for the full text.

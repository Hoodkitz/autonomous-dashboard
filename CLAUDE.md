# Autonomous Dashboard - Claude Code Project Instructions

## Project Overview
Next.js 16 dashboard controlling the Autonomous Symbiotic Engine - a 5-core AI agent orchestration system with OpenRouter integration for 300+ AI models.

## Tech Stack
- **Framework**: Next.js 16.1.6 with Turbopack, App Router
- **Styling**: Tailwind CSS v4 with `@theme inline` pattern
- **Language**: TypeScript strict
- **UI**: Custom dark theme with CSS variables (no shadcn)
- **Agents**: Claude CLI, Gemini CLI, OpenClaw (all via `child_process.spawn`)
- **AI Gateway**: OpenRouter API (streaming chat, 300+ models, usage tracking)

## Architecture
```
app/
  page.tsx              # Engine Control + Proactive Intelligence
  symbiosis/page.tsx    # Symbiotic Engine orchestration view
  chat/page.tsx         # Agent Chat with streaming (CLI + OpenRouter)
  models/page.tsx       # OpenRouter model browser (search, filter, pricing)
  revenue/page.tsx      # Revenue opportunities
  tasks/page.tsx        # Task tracking
  skills/page.tsx       # Installed skills inventory
  vault/page.tsx        # API key management
  logs/page.tsx         # Activity logs
  components/
    sidebar.tsx         # Navigation sidebar with agent status
    status-badge.tsx    # Status indicator component
  lib/
    engine.ts           # State management (reads/writes ~/.autonomous-engine/)
    openrouter.ts       # OpenRouter API client (chat, models, usage)
    meta-prompt.ts      # AIXI-inspired self-improving prompting system
  api/
    engine/route.ts           # GET engine state
    engine/control/route.ts   # POST start/pause/stop/resume
    engine/execute/route.ts   # POST full 5-phase pipeline
    engine/proactive/route.ts # GET/POST proactive intelligence (API discovery, revenue ideas)
    agent/run/route.ts        # POST single agent execution (CLI)
    agent/orchestrate/route.ts # POST multi-agent pipeline
    agent/evolve/route.ts     # POST self-evolution
    meta-prompt/route.ts      # GET/POST meta-prompt system
    openrouter/chat/route.ts  # POST streaming chat with any model
    openrouter/models/route.ts # GET all available models
    openrouter/usage/route.ts  # GET credit usage
    revenue/route.ts          # GET revenue data
    vault/route.ts            # GET vault data
```

## Key Patterns
- **Tailwind v4**: Use explicit color classes (e.g., `bg-accent-dim`), NOT opacity modifiers (`bg-accent/10`)
- **CSS Variables**: All colors defined as `:root` vars, mapped in `@theme inline` block
- **Streaming**: API routes use `ReadableStream` + `TextEncoder` for NDJSON streaming
- **OpenRouter Streaming**: SSE from upstream, parsed and re-emitted as NDJSON
- **State**: Engine state persisted in `~/.autonomous-engine/state.json`
- **API Keys**: Stored in `~/.autonomous-engine/vault/keys.json` (never in git)
- **Proactive**: Engine uses OpenRouter to analyze what APIs/tools are needed and suggests signup links

## Agent Commands
- Claude: `claude --print --dangerously-skip-permissions <prompt>`
- Gemini: `gemini -p <prompt>`
- OpenClaw: `openclaw agent --local --json --message <prompt>`
- OpenRouter: HTTP API via `app/lib/openrouter.ts`

## Running
```bash
npm run dev    # Start dev server on port 3000
npm run build  # Production build
```

## Rule Zero
Never expose API keys, never incur costs, never delete user data. Free tiers only.

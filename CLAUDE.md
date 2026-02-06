# Autonomous Dashboard - Claude Code Project Instructions

## Project Overview
Next.js 16 dashboard controlling the Autonomous Symbiotic Engine - a 5-core AI agent orchestration system.

## Tech Stack
- **Framework**: Next.js 16.1.6 with Turbopack, App Router
- **Styling**: Tailwind CSS v4 with `@theme inline` pattern
- **Language**: TypeScript strict
- **UI**: Custom dark theme with CSS variables (no shadcn)
- **Agents**: Claude CLI, Gemini CLI, OpenClaw (all via `child_process.spawn`)

## Architecture
```
app/
  page.tsx              # Engine Control (dashboard home)
  symbiosis/page.tsx    # Symbiotic Engine orchestration view
  chat/page.tsx         # Agent Chat with streaming
  revenue/page.tsx      # Revenue opportunities
  tasks/page.tsx        # Task tracking
  skills/page.tsx       # Installed skills inventory
  vault/page.tsx        # API key management
  logs/page.tsx         # Activity logs
  components/
    sidebar.tsx         # Navigation sidebar
    status-badge.tsx    # Status indicator component
  lib/
    engine.ts           # State management (reads/writes ~/.autonomous-engine/)
    meta-prompt.ts      # AIXI-inspired self-improving prompting system
  api/
    engine/route.ts           # GET engine state
    engine/control/route.ts   # POST start/pause/stop/resume
    engine/execute/route.ts   # POST full 5-phase pipeline
    agent/run/route.ts        # POST single agent execution
    agent/orchestrate/route.ts # POST multi-agent pipeline
    agent/evolve/route.ts     # POST self-evolution
    meta-prompt/route.ts      # GET/POST meta-prompt system
    revenue/route.ts          # GET revenue data
    vault/route.ts            # GET vault data
```

## Key Patterns
- **Tailwind v4**: Use explicit color classes (e.g., `bg-accent-dim`), NOT opacity modifiers (`bg-accent/10`)
- **CSS Variables**: All colors defined as `:root` vars, mapped in `@theme inline` block
- **Streaming**: API routes use `ReadableStream` + `TextEncoder` for NDJSON streaming
- **State**: Engine state persisted in `~/.autonomous-engine/state.json`
- **Meta-prompts**: Self-improving prompt templates stored in `~/.autonomous-engine/meta-prompts/`

## Agent Commands
- Claude: `claude --print --dangerously-skip-permissions <prompt>`
- Gemini: `gemini -p <prompt>`
- OpenClaw: `openclaw agent --local --json --message <prompt>`

## Running
```bash
npm run dev    # Start dev server on port 3000
npm run build  # Production build
```

## Rule Zero
Never expose API keys, never incur costs, never delete user data. Free tiers only.

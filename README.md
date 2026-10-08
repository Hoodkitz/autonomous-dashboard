# Autonomous Dashboard

> **KI-Agenten-Orchestrierungssystem** — A Next.js control panel for a fully autonomous, self-evolving AI engine. Orchestrates multi-agent swarms across 300+ OpenRouter models, persists state in Supabase, streams results live, and notifies via Telegram.

[![CI](https://github.com/Hoodkitz/autonomous-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Hoodkitz/autonomous-dashboard/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## ✨ Key Features

- **5-Core Autonomous Engine** — Autopilot, Agentic Dev, Ralph Loop, AI Workflow, and Revenue cores run in parallel, with checkpoint-based crash recovery
- **300+ AI Models via OpenRouter** — Streaming responses with automatic failover
- **Supabase Persistence** — Full state management and audit trail
- **Telegram Notifications** — Real-time alerts and progress updates

## 🚀 Installation

```bash
# Repository klonen
git clone https://github.com/Hoodkitz/autonomous-dashboard.git
cd autonomous-dashboard

# Dependencies installieren
npm install

# Environment
cp .env.example .env
# OpenRouter API Key, Supabase URL, Telegram Token eintragen

# Dev-Server starten
npm run dev
```

## 📖 Usage

```typescript
import { AutonomousEngine } from './src/engine';

// Engine starten
const engine = new AutonomousEngine({
  cores: ['autopilot', 'agentic-dev', 'ralph-loop'],
  models: ['openai/gpt-4o', 'anthropic/claude-3-opus'],
});

await engine.start();
```

## 🔌 API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/engine/start` | POST | Engine starten |
| `/api/engine/stop` | POST | Engine stoppen |
| `/api/engine/status` | GET | Engine-Status |
| `/api/agents` | GET | Agenten-Liste |

## 🤝 Contributing

Beiträge sind willkommen! Bitte lies [CONTRIBUTING.md](CONTRIBUTING.md) für Guidelines.

## 📄 License

MIT — Siehe [LICENSE](LICENSE).

# Halcyon — Self-Hosting Guide

A desktop-first, local-first AI character chat platform. Runs entirely on your machine. No account, no cloud sync, no telemetry.

## Requirements

- **[Bun](https://bun.sh)** v1.1+ (recommended) — or Node.js 20+ / npm
- That's it. The database is bundled SQLite (no separate server).

## 1. Install dependencies

```bash
bun install
```

> If you don't have Bun: `npm install` works too, but Bun is faster.

## 2. Configure the database

The default `.env` points to a local SQLite file. You don't need to change anything, just initialize it:

```bash
bun run db:push     # creates the SQLite database + tables
```

This creates `db/custom.db` next to the project root. All your characters, chats, personas, lorebooks, presets, and settings live in this one file.

## 3. Run it on YOUR port

The dev script respects the `PORT` environment variable (defaults to 3000). Pick any port you want:

```bash
# Bash / Linux / macOS
PORT=8080 bun run dev

# Windows (PowerShell)
$env:PORT=8080; bun run dev

# Or just edit package.json's "dev" script to hardcode your port
```

Then open `http://localhost:<your-port>` in your browser.

## 4. Production build (optional, faster)

For a real long-running local server:

```bash
bun run build
bun run start          # respects PORT env var too
```

## Where your data lives

| What | Location |
|---|---|
| Database (all chat data) | `db/custom.db` |
| Uploaded avatars/assets | `upload/` |
| Environment config | `.env` |

**To back up:** just copy `db/custom.db` and the `upload/` folder somewhere safe.

**To move to another machine:** copy the whole project folder (or at minimum `db/custom.db`, `upload/`, and `.env`).

## Using the app

1. Open `http://localhost:<port>` in your browser.
2. You'll land on the **Character Library** — there's a built-in example character.
3. Click it → start chatting. The built-in **Z.AI Cloud** provider works out of the box (no API key needed).
4. **Want to use your own AI provider?** Press `⌘5` (or `Ctrl+5`) → API Manager → Add Profile. Supports OpenAI, Anthropic, Google, and any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, etc.).
   - For **Ollama** (fully offline): provider = `openai-compatible`, base URL = `http://localhost:11434/v1`, API key = anything.
   - For **LM Studio**: base URL = `http://localhost:1234/v1`.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command palette |
| `⌘1`–`⌘7` / `Ctrl+1`–`7` | Switch views |
| `⌘.` / `Ctrl+.` | Focus mode |
| `⌘\` / `Ctrl+\` | Toggle left sidebar |
| `⌘⇧B` / `Ctrl+Shift+B` | Toggle right inspector |

Full reference inside the app: Settings → Shortcuts (`⌘7` then "Shortcuts" tab).

## Tech stack

- Next.js 16 (App Router) + TypeScript 5
- Tailwind CSS 4 + shadcn/ui (New York)
- Prisma ORM + SQLite
- Zustand (client state) + TanStack Query (server state)
- z-ai-web-dev-sdk (built-in AI provider)

## Troubleshooting

**Port already in use?** Pick another: `PORT=3001 bun run dev`.

**Database needs a reset?** `bun run db:reset` (⚠️ deletes all data) then `bun run db:push`.

**Want a fresh start?** Delete `db/custom.db` and run `bun run db:push` again.

Enjoy. 🌙

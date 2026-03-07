# Sequence Game — Local Run Guide

## Prerequisites

| Tool | Version needed | Check with |
|------|---------------|------------|
| Node.js | v18+ (you have v24) | `node -v` |
| npm | bundled with Node | `npm -v` |
| Wrangler CLI | v3+ | `wrangler --version` |
| Cloudflare account | free tier is fine | cloudflare.com |

Install Wrangler globally if you haven't already:
```bash
npm install -g wrangler
```

---

## One-Time Setup (do this once, not every time)

### 1. Log in to Cloudflare

```bash
wrangler login
```

This opens a browser window. Authorize the CLI.

---

### 2. Install dependencies

```bash
# Worker
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/worker
npm install

# Frontend
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/frontend
npm install
```

---

### 3. Create the D1 database

```bash
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/worker
npm run db:create
```

Copy the `database_id` printed in the output, then open `worker/wrangler.toml` and replace the placeholder:

```toml
[[d1_databases]]
binding = "DB"
database_name = "sequence-db"
database_id = "PASTE_YOUR_ID_HERE"   # <-- replace this line
```

---

### 4. Initialise the database schema (creates the users table)

```bash
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/worker
npm run db:init
```

---

### 5. Set the JWT secret

```bash
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/worker
wrangler secret put JWT_SECRET
```

You will be prompted to type a value. Enter any long random string, e.g.:

```
my-super-secret-key-change-this-in-production-abc123
```

> This is only needed once. Wrangler stores it encrypted in `.wrangler/`.

---

### 6. Create the frontend environment file

Create a file at `frontend/.env.local` with this content:

```
VITE_WORKER_URL=http://localhost:8787
```

> This file is gitignored. You only need to create it once.

---

## Running Locally (every time)

You need **two terminals** open simultaneously.

### Terminal 1 — Worker (backend API)

```bash
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/worker
npm run dev
```

Expected output:
```
⎔  Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

---

### Terminal 2 — Frontend

```bash
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/frontend
npm run dev
```

Expected output:
```
  VITE v7.x.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

---

## How to Play

1. **Register** a new account (username: 3–20 chars, letters/numbers/underscore; password: 6+ chars).
2. **Log in** — your session is remembered in the browser tab (closes on tab close).
3. Click **Start Game** to deal cards and begin.
4. **Select a card** from your hand at the bottom of the screen.
   - Valid board cells will pulse/highlight.
5. **Click a highlighted cell** to place your chip.
6. After your move, the AI thinks for ~1.5 seconds, then plays.
7. First to **2 sequences of 5** wins.

### Special cards

| Card | What it does |
|------|-------------|
| One-eyed Jack (J♠ J♥) | Remove any opponent chip that is **not** part of a completed sequence |
| Two-eyed Jack (J♣ J♦) | Wildcard — place your chip on any empty cell |
| Dead card | If both board positions for a card are occupied, click it to swap for a new card from the deck (counts as your turn) |

---

## TypeScript Type-Check (optional)

```bash
# Worker
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/worker
npx tsc --noEmit

# Frontend
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/frontend
npx tsc --noEmit
```

---

## Deploying to Cloudflare (when ready)

### Worker

```bash
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/worker
npm run deploy
```

After deploying, note your worker URL (e.g. `https://sequence-worker.YOUR_SUBDOMAIN.workers.dev`).

Set the JWT secret in production:
```bash
wrangler secret put JWT_SECRET --env production
```

Update `wrangler.toml` `FRONTEND_URL` var to your Pages URL before deploying.

### Frontend

```bash
cd /Users/larahchesnic/Documents/gitRepos/sequence_full_game/frontend
npm run build
```

Upload the `frontend/dist/` folder to Cloudflare Pages (Dashboard → Pages → Upload assets), or connect your GitHub repo for automatic deploys.

Set the environment variable in the Pages dashboard:
```
VITE_WORKER_URL = https://sequence-worker.YOUR_SUBDOMAIN.workers.dev
```

> Note: `VITE_*` env vars are baked in at build time. Set them in the Pages dashboard **before** triggering a build.

---

## Project Structure

```
sequence_full_game/
├── worker/               # Cloudflare Worker (backend)
│   ├── src/
│   │   ├── index.ts      # Hono routes + JWT middleware
│   │   ├── auth.ts       # Register / login handlers
│   │   ├── game.ts       # Start / move handlers
│   │   ├── gameEngine.ts # Board, sequences, move validation
│   │   ├── ai.ts         # Heuristic AI opponent
│   │   └── board.ts      # Hardcoded 10x10 board layout
│   ├── schema.sql        # D1 users table
│   └── wrangler.toml     # Worker config
│
└── frontend/             # React + Vite (frontend)
    └── src/
        ├── App.tsx        # Auth state + view routing
        ├── api/client.ts  # API calls + JWT storage
        ├── types/game.ts  # Shared types + board helpers
        └── components/
            ├── auth/      # LoginForm, RegisterForm
            └── game/      # GameScreen, Board, CardHand, etc.
```

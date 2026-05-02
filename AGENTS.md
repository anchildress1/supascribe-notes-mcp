# Agent Notes (Repo Memory)

This file is for short, durable context so future work doesn't require re-researching.

## What "Apps SDK" Means Here

When we say **Apps SDK**, we mean a **ChatGPT App that shows up in the ChatGPT chat UI** (composer/tool UI),
not a Custom GPT "Actions-only" integration.

Implications:

- The app connects to a **remote MCP server** using **streaming HTTP** transport.
- ChatGPT reads tools via MCP `tools/list`. Each tool definition must include:
  - `title`
  - `description`
  - `inputSchema` (plain JSON Schema object)
  - `annotations` with required hints: `readOnlyHint`, `destructiveHint`, `openWorldHint`
  - `_meta.ui.visibility` (e.g. `["model","app"]`) so tools are not hidden
- If the app includes an embedded UI, it runs in an **iframe** and communicates via MCP `ui/*` bridge.
  Tools can be linked to UI via `_meta.ui.resourceUri` (and/or compatibility `_meta["openai/outputTemplate"]`).

Non-goals:

- A pure REST OpenAPI "Actions-only" server is not sufficient for "Apps SDK app in chat UI".

---

## Context Files by Directory

Each subdirectory that has specialized conventions carries its own `AGENTS.md`. Load the
relevant one whenever you work in that area.

| Directory   | AGENTS.md                                  | When to read                                          |
| ----------- | ------------------------------------------ | ----------------------------------------------------- |
| `tests/`    | [`tests/AGENTS.md`](tests/AGENTS.md)       | Writing, modifying, or reviewing any test file        |
| `supabase/` | [`supabase/AGENTS.md`](supabase/AGENTS.md) | Writing migrations, checking schema, applying changes |
| `docs/`     | [`docs/AGENTS.md`](docs/AGENTS.md)         | Adding or updating documentation                      |

---

## Key Facts

- **Language:** TypeScript (ESM, `"type": "module"`)
- **Runtime:** Node.js 22+
- **Server:** Express v5 + MCP SDK (`@modelcontextprotocol/sdk`)
- **Database:** Supabase (Postgres via `@supabase/supabase-js`)
- **Test runner:** Vitest v3 — `npm test`
- **Linter/formatter:** ESLint + Prettier — `npm run lint`, `npm run format`
- **Hooks:** Lefthook (pre-commit runs format check + lint; commit-msg runs commitlint)
- **Commit style:** Conventional Commits with AI attribution footer (`Co-Authored-By: Claude ...`)

---

## Supabase Migrations

Apply migrations via the Supabase MCP tool (`mcp__plugin_supabase_supabase__apply_migration`), not `supabase db push`. Project ID: `stzewoyiciyxugwkxgwf`.

---

## Source Layout

```
src/
  config.ts         ← env var loading and validation
  index.ts          ← entry point (excluded from coverage)
  server.ts         ← Express app factory + route registration
  lib/              ← supabase client, logger, openapi helpers
  middleware/       ← auth, CORS
  schemas/          ← Zod schemas (card.ts is the main one)
  tools/            ← MCP tool handlers (write-cards, lookup-tools, health)
  views/            ← MCP resource views (auth, help)
supabase/
  migrations/       ← SQL migration files, applied in filename order
```

---

## Soft Delete

Cards have a `deleted_at timestamptz` column. All read paths (lookup by ID, search, discovery views) exclude soft-deleted cards by default. The `lookup_card_by_id` tool accepts `include_deleted: boolean` to opt in. Write paths accept `deleted_at` in the upsert payload.

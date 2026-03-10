# CLAUDE.md — supascribe-notes-mcp

## Always Read First

Before making any change to this repo, read **`AGENTS.md`** in the project root. It contains durable context about what "Apps SDK" means here, MCP tool shape requirements, and other decisions that affect every part of the codebase.

## Context Files by Directory

Each subdirectory that has specialized conventions carries its own `AGENTS.md`. Load the
relevant one in addition to the root `AGENTS.md` whenever you work in that area.

| Directory   | AGENTS.md                                  | When to read                                          |
| ----------- | ------------------------------------------ | ----------------------------------------------------- |
| `tests/`    | [`tests/AGENTS.md`](tests/AGENTS.md)       | Writing, modifying, or reviewing any test file        |
| `supabase/` | [`supabase/AGENTS.md`](supabase/AGENTS.md) | Writing migrations, checking schema, applying changes |
| `docs/`     | [`docs/AGENTS.md`](docs/AGENTS.md)         | Adding or updating documentation                      |

### tests/AGENTS.md

Defines the exact mock patterns for this codebase (harness factory, chainable query builder,
module mock), directory layout, integration test boilerplate, and Vitest-specific rules.
The global `test-writer` skill provides universal principles; `tests/AGENTS.md` layers
the repo-specific implementation on top. Both apply simultaneously.

### supabase/AGENTS.md

Defines migration naming, the **apply-immediately** rule (every migration must be applied
via `mcp__plugin_supabase_supabase__apply_migration` right after commit), security
conventions (RLS, grants), and schema conventions (timestamptz, soft delete, JSONB guards).

### docs/AGENTS.md

Defines what lives in `docs/`, which doc to update for each type of code change, and
writing style rules.

## Key Facts

- **Language:** TypeScript (ESM, `"type": "module"`)
- **Runtime:** Node.js 22+
- **Server:** Express v5 + MCP SDK (`@modelcontextprotocol/sdk`)
- **Database:** Supabase (Postgres via `@supabase/supabase-js`)
- **Test runner:** Vitest v3 — `npm test`
- **Linter/formatter:** ESLint + Prettier — `npm run lint`, `npm run format`
- **Hooks:** Lefthook (pre-commit runs format check + lint; commit-msg runs commitlint)
- **Commit style:** Conventional Commits with AI attribution footer (`Co-Authored-By: Claude ...`)

## Supabase Migrations

Apply migrations via the Supabase MCP tool (`mcp__plugin_supabase_supabase__apply_migration`), not `supabase db push`. Project ID: `stzewoyiciyxugwkxgwf`.

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

## Soft Delete

Cards have a `deleted_at timestamptz` column. All read paths (lookup by ID, search, discovery views) exclude soft-deleted cards by default. The `lookup_card_by_id` tool accepts `include_deleted: boolean` to opt in. Write paths accept `deleted_at` in the upsert payload.

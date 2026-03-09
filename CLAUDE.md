# CLAUDE.md — supascribe-notes-mcp

## Always Read First

Before making any change to this repo, read **`AGENTS.md`** in the project root. It contains durable context about what "Apps SDK" means here, MCP tool shape requirements, and other decisions that affect every part of the codebase.

## When Working on Tests

When writing, modifying, or reviewing anything under `tests/`, also read **`tests/AGENTS.md`**. It defines:

- The exact mock patterns for this codebase (harness factory, chainable query builder, module mock)
- Directory layout and which test type belongs where
- Integration test boilerplate and the three-case auth pattern
- Vitest-specific rules (restoreAllMocks, stubEnv, it.each usage)

The global `test-writer` skill provides universal testing principles (full-path coverage, no `.skip`, no threshold changes). `tests/AGENTS.md` layers the repo-specific implementation on top of those principles. Both apply simultaneously.

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

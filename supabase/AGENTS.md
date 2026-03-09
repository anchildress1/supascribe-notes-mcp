# Supabase Conventions — supascribe-notes-mcp

## Project

- **Project name:** supascribe-notes
- **Project ID:** `stzewoyiciyxugwkxgwf`
- **Region:** us-east-1

---

## Migration Files

All schema changes live in `supabase/migrations/`. Two naming conventions are in use:

| Pattern                                                                              | When to use                                                   |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `NNN_description.sql` (e.g. `009_add_unique_title_blurb.sql`)                        | Legacy sequential style — do not add new files in this format |
| `YYYYMMDDHHmmSS_description.sql` (e.g. `20260308000000_filter_deleted_in_views.sql`) | Current style — use this for all new migrations               |

Each migration file must be idempotent where possible (`CREATE OR REPLACE`, `IF NOT EXISTS`,
`IF EXISTS`, `ALTER ... IF NOT EXISTS`). Migrations that cannot be made idempotent must include
a comment explaining why.

---

## Apply Immediately After Every Commit

**Every migration file must be applied to the remote project immediately after it is committed.**
Do not let migration files sit unapplied. The workflow is:

1. Write the migration SQL in `supabase/migrations/<timestamp>_<name>.sql`
2. Commit the file
3. Apply it immediately using the Supabase MCP tool:

```
mcp__plugin_supabase_supabase__apply_migration
  project_id: stzewoyiciyxugwkxgwf
  name: <snake_case description matching filename>
  query: <full SQL from the file>
```

Verify success before moving on. If the tool returns an error, resolve it before closing
the task — a committed-but-unapplied migration leaves the codebase and database out of sync.

---

## Checking Applied Migrations

To see what has already been applied:

```
mcp__plugin_supabase_supabase__list_migrations
  project_id: stzewoyiciyxugwkxgwf
```

If a migration file exists locally but is not in the list, apply it before writing new ones.

---

## Security Conventions

- RLS must remain enabled on all tables. Never `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`.
- Discovery views use `security_invoker = true` and `security_barrier = true` (see migration 006).
- Grants go to `anon` and `authenticated` roles only — never to `postgres` or `service_role`.
- Do not reference the `service_role` key in SQL.

---

## Schema Conventions

- Timestamps: always `timestamptz`, never `timestamp`.
- Soft deletes: use a `deleted_at timestamptz` column. Do not hard-delete cards.
- JSON columns (e.g. `tags`): validate structure in the application layer (Zod), not via
  Postgres check constraints, to keep migration diffs small.
- Views that aggregate card data must always filter `WHERE deleted_at IS NULL` and, for
  JSONB array unnesting, guard with `jsonb_typeof(col) = 'array'` to prevent scalar errors.

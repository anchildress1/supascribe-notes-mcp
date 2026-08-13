# Supabase Conventions — supascribe-notes-mcp

## Project

- **Project name:** supascribe-notes
- **Project ID:** `stzewoyiciyxugwkxgwf`
- **Region:** us-east-1
- **Shared tenancy:** this project also hosts `house-of-accusations`, scoped to its own
  `accusations` schema. `list_migrations` and other project-wide calls return its
  migrations too (e.g. `consolidated_suspicion_schema`) — that's cross-tenant noise, not
  drift in this repo's history. Never create, alter, or drop anything outside `public`
  from here.

---

## Migration Files

- Location: `supabase/migrations/`
- Current naming: `YYYYMMDDHHmmSS_description.sql` (e.g. `20260308000000_filter_deleted_in_views.sql`)
- Legacy naming `NNN_description.sql` exists (e.g. `009_add_unique_title_blurb.sql`) — do not add new files in this format
- Idempotent where possible (`CREATE OR REPLACE`, `IF NOT EXISTS`, `IF EXISTS`,
  `ALTER ... IF NOT EXISTS`). If a migration can't be made idempotent, comment explaining why.

---

## Migration Workflow

1. Write SQL in `supabase/migrations/<timestamp>_<name>.sql`.
2. Commit the file.
3. Apply immediately — do not leave a committed migration unapplied:

```
mcp__supabase__apply_migration
  name: <snake_case description matching filename>
  query: <full SQL from the file>
```

4. Verify the call succeeded; resolve any error before closing the task.

If `mcp__supabase__*` tools aren't loaded/authenticated, call
`mcp__plugin_supabase_supabase__authenticate` first and complete the OAuth flow before
retrying.

To check what's already applied: `mcp__supabase__list_migrations` (no params). If a local
file isn't in the list, apply it before writing new ones. Entries from
`house-of-accusations` will also appear — see Shared tenancy above.

---

## Security Conventions

- RLS must remain enabled on all tables. Never `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`.
- Grants go to `anon` and `authenticated` roles only — never to `postgres` or `service_role`.
- Do not reference the `service_role` key in SQL.

### View Security

`CREATE OR REPLACE VIEW` silently resets previously-set view options — they do not survive
a recreation unless re-declared in the same statement. Every migration touching a view must
inline them:

```sql
CREATE OR REPLACE VIEW public.my_view
  WITH (security_invoker = true, security_barrier = true)
AS
SELECT ...;
```

---

## Schema Conventions

- Timestamps: always `timestamptz`, never `timestamp`.
- Soft deletes: `deleted_at timestamptz` column. Do not hard-delete cards.
- JSON columns (e.g. `tags`): validate structure in the application layer (Zod), not via
  Postgres check constraints, to keep migration diffs small.
- Views aggregating card data must filter `WHERE deleted_at IS NULL` and, for JSONB array
  unnesting, guard with `jsonb_typeof(col) = 'array'` to prevent scalar errors.

# Agent Notes (Repo Memory)

## "Apps SDK" Scope

"Apps SDK" means a ChatGPT App in the chat UI (composer/tool UI) — not a Custom GPT
Actions-only integration. A pure REST OpenAPI server does not satisfy this.

- Transport is streaming HTTP to a remote MCP server; ChatGPT reads tools via `tools/list`.
- Every tool definition needs `title`, `description`, `inputSchema` (plain JSON Schema),
  `annotations` (`readOnlyHint`, `destructiveHint`, `openWorldHint`), and
  `_meta.ui.visibility` (e.g. `["model","app"]`) — omit the last and the tool stays hidden.
- Embedded UI runs in an iframe over the MCP `ui/*` bridge; link it via
  `_meta.ui.resourceUri` (and/or `_meta["openai/outputTemplate"]` for compatibility).

---

## Directory-Scoped Context

| Directory   | AGENTS.md                                  | Read before                       |
| ----------- | ------------------------------------------ | --------------------------------- |
| `tests/`    | [`tests/AGENTS.md`](tests/AGENTS.md)       | writing/modifying/reviewing tests |
| `supabase/` | [`supabase/AGENTS.md`](supabase/AGENTS.md) | migrations, schema changes        |
| `docs/`     | [`docs/AGENTS.md`](docs/AGENTS.md)         | adding/updating documentation     |

---

## Soft Delete

`deleted_at timestamptz` on cards. All read paths (lookup by ID, search, discovery views)
exclude soft-deleted rows by default; `lookup_card_by_id` takes `include_deleted: boolean`
to opt in. Write paths accept `deleted_at` in the upsert payload.

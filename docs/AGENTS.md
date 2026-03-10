# Docs Conventions — supascribe-notes-mcp

## What Lives Here

```
docs/
  references.md          ← authoritative external URLs (MCP, Supabase, GCP, OpenAI)
  troubleshoot-tools.md  ← ChatGPT tool visibility and MCP verification checklist
  images/                ← architecture diagrams and screenshots
```

---

## Keeping Docs Current

Documentation in this directory describes runtime behavior — tool shapes, auth flows,
deployment steps, and known platform quirks. It goes stale when the code changes.

When you modify any of the following, update the relevant doc file in the same commit:

| Change                                            | Doc to update                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| Add, rename, or remove an MCP tool                | `troubleshoot-tools.md` → "Confirm MCP list is complete"            |
| Change a tool's `annotations` or `_meta` shape    | `troubleshoot-tools.md` → "Required Fields on Each Tool Descriptor" |
| Add or change an auth flow                        | `troubleshoot-tools.md` → "Auth Consent Page" section               |
| Add a new external dependency or reference URL    | `references.md`                                                     |
| Change the deployment process or Cloud Run config | `troubleshoot-tools.md` → "Full Verification Checklist"             |

---

## Style

- Write for an AI agent reader as the primary audience (concise, structured, scannable).
- Use tables for anything with a fixed set of options or fields.
- Use fenced code blocks with language identifiers for all code and TypeScript examples.
- Prefer present tense ("the tool returns") over past tense.
- No marketing language. No filler.

---

## Images

Architecture diagrams go in `docs/images/`. Reference them in `README.md` with a relative
path. Regenerate diagrams when the architecture changes — a stale diagram is worse than
no diagram.

---

## What Does Not Go Here

- Changelog entries → `CHANGELOG.md` at the repo root
- Migration notes → commit messages and `supabase/AGENTS.md`
- API contracts and schemas → source of truth is the Zod schemas in `src/schemas/`
  and the live OpenAPI spec at `/openapi.json`

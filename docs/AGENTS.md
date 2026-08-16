# Docs Conventions — supascribe-notes-mcp

## Keeping Docs Current

Update the relevant file in the same commit as the code change:

| Change                                            | Doc to update                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| Add, rename, or remove an MCP tool                | `troubleshoot-tools.md` → "Confirm MCP list is complete"            |
| Change a tool's `annotations` or `_meta` shape    | `troubleshoot-tools.md` → "Required Fields on Each Tool Descriptor" |
| Add or change an auth flow                        | `troubleshoot-tools.md` → "Auth Consent Page" section               |
| Add a new external dependency or reference URL    | `references.md`                                                     |
| Change the deployment process or Cloud Run config | `troubleshoot-tools.md` → "Full Verification Checklist"             |

---

## Style

- AI-agent reader is the primary audience: concise, structured, scannable.
- Tables for anything with a fixed set of options or fields.
- Fenced code blocks with language identifiers.
- Present tense ("the tool returns"). No marketing language, no filler.

---

## Diagrams

Mermaid only, fenced inline in the Markdown file that uses them. No rendered image files —
they drift from the code and cannot be reviewed in a diff.

- Include `accTitle:` and `accDescr:` on every diagram.
- Validate syntax before committing.
- Update the diagram in the same commit as the architecture change.

---

## What Does Not Go Here

- Changelog entries → `CHANGELOG.md` at the repo root
- Migration notes → commit messages and `supabase/AGENTS.md`
- API contracts and schemas → source of truth is the Zod schemas in `src/schemas/` and
  the live OpenAPI spec at `/openapi.json`

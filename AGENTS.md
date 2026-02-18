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

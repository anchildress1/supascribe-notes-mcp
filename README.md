# Supascribe Notes MCP

A TypeScript MCP server that writes index cards to Supabase, deployed on Google Cloud Run.

## MCP Tools

| Tool                | Description                                                         |
| ------------------- | ------------------------------------------------------------------- |
| `health`            | Check server status and Supabase connectivity                       |
| `write_cards`       | Validate and upsert index cards with revision history               |
| `lookup_card_by_id` | Find specific index cards by UUID list (excludes soft-deleted)      |
| `lookup_categories` | Get all unique categories used across active cards                  |
| `lookup_projects`   | Get all unique project identifiers used across active cards         |
| `lookup_tags`       | Get all unique lvl0/lvl1 tags used across active cards              |
| `search_cards`      | Keyword search by category/tag/project/fact (excludes soft-deleted) |

## Tech Stack

| Layer         | Tools                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| Runtime       | Node.js 22, TypeScript, Express 5                                            |
| MCP & AI      | `@modelcontextprotocol/sdk`, OpenAI SDK                                      |
| Data          | Supabase (`@supabase/supabase-js`), Zod validation                           |
| Logging       | Pino                                                                         |
| Testing       | Vitest, `@vitest/coverage-v8`                                                |
| Quality Gates | ESLint, Prettier, Lefthook, Commitlint + `commitlint-plugin-rai`, secretlint |
| Infra & CI/CD | Google Cloud Run, GitHub Actions, Release Please                             |

## Architecture

![Sequence Diagram](docs/images/architecture-sequence-diagram.png)

## Prerequisites

- Node.js 22+
- Docker (for containerized deployment)
- Google Cloud CLI (`gcloud`) — for Cloud Run deployment
- A Supabase project with the schema applied

## Setup

```bash
# Install dependencies and git hooks
make install
```

### Environment Variables

| Variable                    | Required | Description                                                          |
| --------------------------- | -------- | -------------------------------------------------------------------- |
| `SUPABASE_URL`              | ✅       | Supabase project URL                                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅       | Supabase service role key                                            |
| `SUPABASE_ANON_KEY`         | ✅       | Supabase anon key (auth UI)                                          |
| `SUPABASE_ACCESS_TOKEN`     | ❌       | Supabase CLI/MCP token (required only to apply remote migrations)    |
| `PORT`                      | ❌       | Server port (default: `8080`)                                        |
| `PUBLIC_URL`                | ✅       | Public URL for OAuth & MCP transport endpoints                       |
| `SERVER_VERSION`            | ❌       | MCP/OpenAPI version hint for client cache busting (default: `1.0.0`) |

## Authentication

This server uses **Supabase Auth** via OAuth 2.0 for all MCP operations. MCP clients (like ChatGPT) will automatically discover the OAuth configuration via:

- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`

Standard `Authorization: Bearer <token>` header is required for MCP transport endpoints.

## ChatGPT SDK Endpoints

The OpenAPI surface at `/openapi.json` exposes these tool-compatible REST endpoints:

- `POST /api/write-cards`
- `POST /api/lookup-card-by-id`
- `GET /api/lookup-categories`
- `GET /api/lookup-projects`
- `GET /api/lookup-tags`
- `POST /api/search-cards`

`lookup-card-by-id` expects an array payload:

```json
{
  "ids": ["<uuid>", "<uuid>"]
}
```

When adding/changing tools, bump `SERVER_VERSION` before deploy so ChatGPT refreshes cached tool metadata.

## Database Schema

Apply the migrations in `supabase/migrations` using the Supabase CLI or the SQL editor. Keep RLS enabled and re-run lint if you touch policies.

## Development

```bash
# Start dev server with hot reload
make dev

# Run tests
make test

# Run tests with coverage
make test-coverage

# Lint and format
make lint
make format

# Run all CI checks locally
make ai-checks
```

## Docker

```bash
# Build
docker build -t supascribe-notes-mcp .

# Run
docker run -p 8080:8080 --env-file .env supascribe-notes-mcp
```

## Deploy to Cloud Run

```bash
# Set your GCP project
gcloud config set project anchildress1-unstable

# Deploy
bash deploy.sh
```

After deployment, verify the service is running:

```bash
# Replace with your deployed Cloud Run service URL
# You can find this in the Cloud Run console or with:
# gcloud run services describe supascribe-notes --region YOUR_REGION --format='value(status.url)'
SERVICE_URL="https://your-service-url"

# 1. Health check (Public)
curl "$SERVICE_URL/status"

# 2. Streamable HTTP initialize (Requires Auth)
# Replace YOUR_TOKEN with a valid Supabase JWT
curl -i -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}' \
  "$SERVICE_URL"
```

The initialize response returns `Mcp-Session-Id` in response headers. Use that header on subsequent MCP requests.

To fully test the MCP functionality, configure your MCP client to connect to the Streamable HTTP endpoint:

- **URL**: `$SERVICE_URL`
- **Auth**: Use the standard OAuth 2.1 flow supported by your client, pointing to your Supabase project's auth endpoints.

## Card Shape

```json
{
  "objectID": "uuid (auto-generated)",
  "title": "string (required)",
  "blurb": "string (required)",
  "fact": "string (required)",
  "url": "string (optional, must be valid URL)",
  "tags": { "lvl0": ["string"], "lvl1": ["string"] }, // both arrays are required (use [] when empty)
  "projects": ["string"],
  "category": "string (required)",
  "signal": "number 1–5 (required)",
  "created_at": "timestamptz (optional input for historical imports; normalized on write)",
  "updated_at": "timestamptz (auto)",
  "deleted_at": "timestamptz (optional soft-delete timestamp; omit to leave deletion status unchanged)"
}
```

## CI/CD

- **GitHub Actions** — lint, test (85% business-logic coverage), secrets scan, build
- **Release Please** — conventional commit based semantic versioning
- **Commitlint + rai-lint** — enforces AI attribution footers
- **Lefthook** — git hooks for commit message validation

## Security

- **OAuth-gated for MCP + API calls.** MCP protocol requests (to `/` when negotiated as MCP) and `/api/*` endpoints require a Supabase-issued Bearer token; missing/invalid tokens return a 401 + `WWW-Authenticate` challenge (MCP always returns a plain-text 401). Browser-facing routes (help page, `/auth/authorize`, `/health`, `/openapi.json`, and `/.well-known/*`) are intentionally public.
- **Input handled like it's hostile.** `authorization_id` is regex-constrained to a safe token shape and URL-encoded before it's ever interpolated into a redirect. Config values injected into the consent page's inline script are escaped against `</script>` breakout.
- **RLS enforced at the database.** Row-Level Security stays on for every table — see [Database Schema](#database-schema) before touching policies.
- **No secrets in the repo.** `secretlint` runs in CI and via Lefthook's pre-commit hook, before a commit ever lands.

## License

PolyForm Shield 1.0.0

## Author

**Ashley Childress** — [GitHub](https://github.com/anchildress1) · [LinkedIn](https://linkedin.com/in/anchildress1) · [DEV.to](https://dev.to/anchildress1)

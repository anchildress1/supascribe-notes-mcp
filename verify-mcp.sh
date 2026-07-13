#!/bin/bash

# verify-mcp.sh - Verify Streamable HTTP MCP flow on the service root

if [[ -z "$1" ]]; then
  echo "Usage: ./verify-mcp.sh <SUPABASE_ACCESS_TOKEN>"
  echo ""
  echo "  Example:"
  echo "    ./verify-mcp.sh eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  echo ""
  echo "  To get a token manually:"
  echo "    1. Open your app/site in a browser where you are logged in"
  echo "    2. Open DevTools Console"
  echo "    3. Run: (await supabase.auth.getSession()).data.session.access_token"
  exit 1
fi

TOKEN=$1
URL=${2:-"http://localhost:8080"}

echo "Testing Streamable HTTP MCP flow against $URL..."
echo "-------------------------------------------------"

INIT_RESPONSE=$(curl -sS -i -X POST \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  --data '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"verify-script","version":"1.0.0"}}}' \
  "$URL")

SESSION_ID=$(printf '%s\n' "$INIT_RESPONSE" | awk -F': ' 'tolower($1)=="mcp-session-id" {gsub("\r","",$2); print $2; exit}')

if [[ -z "$SESSION_ID" ]]; then
  echo "Failed to initialize MCP session. Full response:"
  echo "$INIT_RESPONSE"
  exit 1
fi

echo "Initialized session: $SESSION_ID"
echo "$INIT_RESPONSE" | tail -n 20

echo ""
echo "Sending notifications/initialized..."
curl -sS -o /dev/null -w "HTTP %{http_code}\n" -X POST \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  --data '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  "$URL"

echo ""
echo "Requesting tools/list..."
curl -sS -i -X POST \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  "$URL"

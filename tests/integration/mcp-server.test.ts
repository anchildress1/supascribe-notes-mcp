import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createApp } from '../../src/server.js';
import { invokeApp, testConfig } from '../helpers/http.js';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

// Mock Supabase client
vi.mock('../../src/lib/supabase.js', () => ({
  createSupabaseClient: vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'cards') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockResolvedValue({ error: null }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }),
    auth: {
      getUser: vi.fn().mockImplementation(async (token) => {
        if (token === 'test-token') {
          return {
            data: {
              user: {
                id: 'test-user',
                email: 'test@example.com',
                role: 'authenticated',
              },
            },
            error: null,
          };
        }
        return {
          data: { user: null },
          error: { message: 'Invalid token' },
        };
      }),
    },
  }),
}));

const hasForbiddenSchemaKey = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasForbiddenSchemaKey);

  const objectValue = value as Record<string, unknown>;
  if ('$schema' in objectValue || 'default' in objectValue) return true;
  return Object.values(objectValue).some(hasForbiddenSchemaKey);
};

const withConnectedStreamableClient = async (
  app: ReturnType<typeof createApp>,
  run: (context: { client: Client; transport: StreamableHTTPClientTransport }) => Promise<void>,
  path = '/',
): Promise<void> => {
  const httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  const url = new URL(`http://127.0.0.1:${port}${path}`);

  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        Authorization: 'Bearer test-token',
      },
    },
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

  await client
    .connect(transport)
    .then(async () => run({ client, transport }))
    .finally(async () => {
      await client.close();
      await new Promise<void>((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    });
};

describe('MCP Server Integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp(testConfig);
  });

  it('GET /status returns 200 ok', async () => {
    const { res } = await invokeApp(app, { method: 'GET', url: '/status' });
    expect(res.statusCode).toBe(200);
    const body = res._getJSON() as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.version).toBe('1.0.0');
  });

  it('GET / returns 200 and HTML help page', async () => {
    const { res } = await invokeApp(app, { method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res._getHeaders()['content-type']).toContain('text/html');
    const text = res._getData();
    expect(text).toContain('Supabase MCP Server');
    expect(text).toContain('<!DOCTYPE html>');
  });

  it('HEAD / returns the help page unauthenticated, same as a browser GET', async () => {
    // Express auto-serves HEAD through a GET handler, so this worked for free before
    // the root route had to distinguish browsers from MCP clients. Uptime monitors and
    // `curl -I $SERVICE_URL` send HEAD — they must not start getting a 401.
    const { res } = await invokeApp(app, { method: 'HEAD', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res._getHeaders()['content-type']).toContain('text/html');
  });

  it('GET / is treated as an MCP request when Accept: text/event-stream (401 + challenge, no auth)', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/',
      headers: { accept: 'text/event-stream' },
    });
    expect(res.statusCode).toBe(401);
    expect(res._getHeaders()['www-authenticate']).toContain('Bearer');
  });

  it('GET /auth/authorize returns Consent UI', async () => {
    const { res } = await invokeApp(app, { method: 'GET', url: '/auth/authorize' });
    expect(res.statusCode).toBe(200);
    const text = res._getData();
    expect(text).toContain('Authorize Access');
    expect(text).toContain('External Application');
    expect(text).toContain('approve()');
    expect(text).toContain('deny()');
  });

  it.each([
    [
      'redirects to /auth/authorize with valid UUID-shaped id',
      '/mcp/auth/authorize?authorization_id=550e8400-e29b-41d4-a716-446655440000',
      '/auth/authorize?authorization_id=550e8400-e29b-41d4-a716-446655440000',
    ],
    [
      'redirects to /auth/authorize with a real Supabase-shaped opaque token',
      '/mcp/auth/authorize?authorization_id=42vmbzf3xo5bt3eeqre7rnonuqvtc2oz',
      '/auth/authorize?authorization_id=42vmbzf3xo5bt3eeqre7rnonuqvtc2oz',
    ],
    [
      'strips path-traversal authorization_id',
      '/mcp/auth/authorize?authorization_id=../../evil',
      '/auth/authorize',
    ],
    [
      'strips unknown params and rejects too-short authorization_id',
      '/mcp/auth/authorize?authorization_id=123&redirect_uri=https://evil.com',
      '/auth/authorize',
    ],
    ['redirects cleanly with no params', '/mcp/auth/authorize', '/auth/authorize'],
  ])(
    'GET /mcp/auth/authorize %s',
    async (_label: string, url: string, expectedLocation: string) => {
      const { res } = await invokeApp(app, { method: 'GET', url });
      expect(res.statusCode).toBe(307);
      expect(res._getHeaders().location).toBe(expectedLocation);
    },
  );

  it('GET / returns 401 with invalid auth', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/',
      headers: {
        accept: 'text/event-stream',
        authorization: 'Bearer invalid-token',
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('DELETE / (session termination) is routed as an MCP request even without an event-stream Accept header', async () => {
    // Proves the `req.method !== 'GET'` branch of isMcpRequest actually matters —
    // without it, a DELETE with a plain/no Accept header would fall through to
    // the HTML help page instead of MCP session teardown.
    const { res } = await invokeApp(app, {
      method: 'DELETE',
      url: '/',
      headers: { accept: 'text/html' },
    });
    expect(res.statusCode).toBe(401);
    expect(res._getHeaders()['www-authenticate']).toContain('Bearer');
  });

  it('GET / with an Accept header that prefers neither html nor event-stream falls back to the help page', async () => {
    // Documents current, intentional behavior for strict JSON-only clients:
    // they get the help page (200 HTML), not an MCP response or an error.
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/',
      headers: { accept: 'application/json' },
    });
    expect(res.statusCode).toBe(200);
    expect(res._getHeaders()['content-type']).toContain('text/html');
  });

  it('GET /.well-known/oauth-authorization-server returns metadata', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/.well-known/oauth-authorization-server',
    });
    expect(res.statusCode).toBe(200);
    expect(res._getHeaders()['cache-control']).toContain('no-store');
    const body = res._getJSON() as {
      authorization_endpoint: string;
      token_endpoint: string;
    };
    expect(body.authorization_endpoint).toBe(`${testConfig.supabaseUrl}/auth/v1/oauth/authorize`);
    expect(body.token_endpoint).toBe(`${testConfig.supabaseUrl}/auth/v1/oauth/token`);
  });

  it('GET /.well-known/oauth-protected-resource returns metadata', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/.well-known/oauth-protected-resource',
    });
    expect(res.statusCode).toBe(200);
    expect(res._getHeaders()['cache-control']).toContain('no-store');
    const body = res._getJSON() as { resource: string };
    expect(body.resource).toBe(testConfig.publicUrl);
  });

  it('GET /.well-known/oauth-protected-resource/mcp returns the same metadata (ChatGPT compat)', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/.well-known/oauth-protected-resource/mcp',
    });
    expect(res.statusCode).toBe(200);
    expect(res._getHeaders()['cache-control']).toContain('no-store');
    const body = res._getJSON() as { resource: string };
    expect(body.resource).toBe(testConfig.publicUrl);
  });

  it('Streamable client initializes successfully via root MCP endpoint', async () => {
    await withConnectedStreamableClient(app, async ({ transport }) => {
      expect(transport.sessionId).toBeTruthy();
    });
  });

  it('Streamable client initializes successfully via the legacy /mcp URL (307 compat redirect)', async () => {
    // Proves the /mcp -> / redirect actually works end-to-end for a real client, not
    // just that it returns 307 — a 307 that a client doesn't follow, or that drops the
    // POST body on the way, would still break every already-configured client.
    await withConnectedStreamableClient(
      app,
      async ({ transport }) => {
        expect(transport.sessionId).toBeTruthy();
      },
      '/mcp',
    );
  });

  it('full MCP flow: streamable initialize → list tools', async () => {
    await withConnectedStreamableClient(app, async ({ client }) => {
      const listResult = await client.listTools();

      const expectedToolNames = [
        'health',
        'write_cards',
        'lookup_card_by_id',
        'lookup_categories',
        'lookup_projects',
        'lookup_tags',
        'search_cards',
      ];

      const tools = listResult.tools;
      expect(tools).toBeDefined();
      expect(tools).toHaveLength(expectedToolNames.length);

      const toolNames = tools
        .map((tool) => String(tool.name))
        .sort((left, right) => left.localeCompare(right));
      expect(toolNames).toEqual(
        [...expectedToolNames].sort((left, right) => left.localeCompare(right)),
      );

      const writeTool = tools.find((tool) => tool.name === 'write_cards') as Record<
        string,
        unknown
      >;
      expect(writeTool).toBeDefined();

      expect(writeTool.inputSchema).toBeDefined();
      expect((writeTool.inputSchema as { type?: string }).type).toBe('object');
      expect(
        (writeTool.inputSchema as { properties?: Record<string, unknown> }).properties,
      ).toBeDefined();
      expect(
        (writeTool.inputSchema as { properties?: Record<string, { type?: string }> }).properties
          ?.cards,
      ).toBeDefined();
      expect(
        (writeTool.inputSchema as { properties?: Record<string, { type?: string }> }).properties
          ?.cards?.type,
      ).toBe('array');

      const writeCardsItems = (
        (
          writeTool.inputSchema as {
            properties?: Record<string, { items?: { properties?: Record<string, unknown> } }>;
          }
        ).properties?.cards?.items as { properties?: Record<string, unknown> }
      )?.properties;
      const tagsSchema = writeCardsItems?.tags as
        | {
            properties?: Record<string, { type?: string }>;
            required?: string[];
          }
        | undefined;
      expect(tagsSchema).toBeDefined();
      expect(tagsSchema?.properties?.lvl0?.type).toBe('array');
      expect(tagsSchema?.properties?.lvl1?.type).toBe('array');
      expect(tagsSchema?.required).toEqual(expect.arrayContaining(['lvl0', 'lvl1']));
      expect((writeCardsItems?.deleted_at as { type?: string })?.type).toBe('string');

      for (const name of expectedToolNames) {
        const tool = tools.find((candidate) => candidate.name === name) as
          | {
              title?: string;
              annotations?: {
                readOnlyHint?: boolean;
                destructiveHint?: boolean;
                openWorldHint?: boolean;
              };
              _meta?: { ui?: { visibility?: string[] } };
            }
          | undefined;
        expect(tool).toBeDefined();
        expect(tool?.title).toBeTruthy();
        expect(tool?.annotations).toBeDefined();
        expect(tool?.annotations?.readOnlyHint).not.toBeUndefined();
        expect(tool?.annotations?.destructiveHint).not.toBeUndefined();
        expect(tool?.annotations?.openWorldHint).not.toBeUndefined();
        expect(tool?._meta?.ui?.visibility).toEqual(['model', 'app']);
        expect(hasForbiddenSchemaKey((tool as { inputSchema?: unknown }).inputSchema)).toBe(false);
      }
    });
  });

  it('POST / returns 404 for unknown session header', async () => {
    const { res } = await invokeApp(app, {
      method: 'POST',
      url: '/',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: 'Bearer test-token',
        'mcp-session-id': 'unknown-session-id',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      },
    });

    expect(res.statusCode).toBe(404);
    const body = res._getJSON() as {
      error?: { code?: number; message?: string };
    };
    expect(body.error?.code).toBe(-32001);
    expect(body.error?.message).toContain('Session not found');
  });
});

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createApp } from '../../src/server.js';
import type { Config } from '../../src/config.js';
import { invokeApp } from '../helpers/http.js';
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

const testConfig: Config = {
  supabaseUrl: 'http://localhost:54321',
  supabaseServiceRoleKey: 'test-key',
  supabaseAnonKey: 'anon-key',
  port: 0,
  publicUrl: 'http://localhost:0',
  serverVersion: '1.0.0',
};

const hasForbiddenSchemaKey = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasForbiddenSchemaKey);

  const objectValue = value as Record<string, unknown>;
  if ('$schema' in objectValue || 'default' in objectValue) return true;
  return Object.values(objectValue).some(hasForbiddenSchemaKey);
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

  it('GET / redirects to /mcp if Accept: text/event-stream', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/',
      headers: { accept: 'text/event-stream' },
    });
    expect(res.statusCode).toBe(307);
    expect(res._getHeaders().location).toBe('/mcp');
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

  it('GET /mcp/auth/authorize redirects to /auth/authorize', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/mcp/auth/authorize?authorization_id=123',
    });
    expect(res.statusCode).toBe(302);
    expect(res._getHeaders().location).toBe('/auth/authorize?authorization_id=123');
  });

  it('GET /mcp returns 401 without auth', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/mcp',
      headers: { accept: 'text/event-stream' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /mcp returns 401 with invalid auth', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/mcp',
      headers: {
        accept: 'text/event-stream',
        authorization: 'Bearer invalid-token',
      },
    });
    expect(res.statusCode).toBe(401);
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

  it('GET /.well-known/oauth-protected-resource/mcp returns specific metadata', async () => {
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/.well-known/oauth-protected-resource/mcp',
    });
    expect(res.statusCode).toBe(200);
    expect(res._getHeaders()['cache-control']).toContain('no-store');
    const body = res._getJSON() as { resource: string };
    expect(body.resource).toBe(testConfig.supabaseUrl);
  });

  it('Streamable client initializes successfully via /mcp', async () => {
    const httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    const url = new URL(`http://127.0.0.1:${port}/mcp`);

    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          Authorization: 'Bearer test-token',
        },
      },
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    await client.connect(transport);
    expect(transport.sessionId).toBeTruthy();
    await client.close();
    await new Promise<void>((resolve, reject) =>
      httpServer.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('full MCP flow: streamable initialize → list tools', async () => {
    const httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const { port } = httpServer.address() as AddressInfo;
    const url = new URL(`http://127.0.0.1:${port}/mcp`);

    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: {
          Authorization: 'Bearer test-token',
        },
      },
    });
    const client = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    await client.connect(transport);

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

    const toolNames = tools.map((tool) => String(tool.name)).sort();
    expect(toolNames).toEqual([...expectedToolNames].sort());

    const writeTool = tools.find((tool) => tool.name === 'write_cards') as Record<string, unknown>;
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

    await client.close();
    await new Promise<void>((resolve, reject) =>
      httpServer.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('POST /mcp returns 404 for unknown session header', async () => {
    const { res } = await invokeApp(app, {
      method: 'POST',
      url: '/mcp',
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

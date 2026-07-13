import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../src/server.js';
import type { Config } from '../../src/config.js';
import { invokeApp } from '../helpers/http.js';

const testConfig: Config = {
  supabaseUrl: 'http://localhost:54321',
  supabaseServiceRoleKey: 'test-key',
  supabaseAnonKey: 'anon-key',
  port: 0, // Random port
  publicUrl: 'http://localhost:0',
  serverVersion: '1.0.0',
};

// Mock dependencies
vi.mock('../../src/lib/supabase.js', () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock('../../src/lib/auth-provider.js', () => ({
  SupabaseTokenVerifier: vi.fn().mockImplementation(() => ({
    verifyAccessToken: vi.fn().mockResolvedValue({
      sub: 'test-user',
      email: 'test@example.com',
      role: 'authenticated',
    }),
  })),
}));

// Mock MCP Server
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(() => ({
    registerTool: vi.fn(),
    connect: vi.fn().mockImplementation(async (transport) => {
      await transport.start();
    }),
    server: {
      setRequestHandler: vi.fn(),
    },
  })),
}));

// Mock StreamableHTTPServerTransport
const mocks = vi.hoisted(() => {
  return {
    start: vi.fn().mockResolvedValue(undefined),
    handleRequest: vi.fn().mockImplementation(async (_req, res) => {
      res.status(200).json({ ok: true });
    }),
    close: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
  return {
    StreamableHTTPServerTransport: vi.fn().mockImplementation(() => ({
      start: mocks.start,
      handleRequest: mocks.handleRequest,
      close: mocks.close,
      sessionId: undefined,
      onclose: vi.fn(),
    })),
  };
});

describe('Server Error Handling', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = createApp(testConfig);
  });

  it('POST / initializes streamable transport and calls start exactly once', async () => {
    const { res } = await invokeApp(app, {
      method: 'POST',
      url: '/',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.handleRequest).toHaveBeenCalledTimes(1);
  });

  it('POST / returns 500 if transport start fails and closes transport', async () => {
    mocks.start.mockRejectedValue(new Error('Failed to initialize session'));

    const { res } = await invokeApp(app, {
      method: 'POST',
      url: '/',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      },
    });

    expect(res.statusCode).toBe(500);
    const body = res._getJSON() as {
      error?: { code?: number; message?: string };
    };
    expect(body.error?.code).toBe(-32603);
    expect(body.error?.message).toBe('Internal error');
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('POST / returns 404 for unknown session header', async () => {
    mocks.start.mockResolvedValue(undefined);

    const { res } = await invokeApp(app, {
      method: 'POST',
      url: '/',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        authorization: 'Bearer token',
        'mcp-session-id': 'test-session',
      },
      body: { jsonrpc: '2.0', method: 'ping' },
    });

    expect(res.statusCode).toBe(404);
    const body = res._getJSON() as {
      error?: { code?: number; message?: string };
    };
    expect(body.error?.code).toBe(-32001);
    expect(body.error?.message).toBe('Session not found');
    expect(mocks.start).toHaveBeenCalledTimes(0);
    expect(mocks.handleRequest).toHaveBeenCalledTimes(0);
  });
});

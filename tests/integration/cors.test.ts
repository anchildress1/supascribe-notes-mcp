import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/server.js';
import type { Config } from '../../src/config.js';
import { invokeApp } from '../helpers/http.js';

vi.mock('../../src/lib/supabase.js', () => ({
  createSupabaseClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
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

const resolveCorsOrigin = async (
  app: ReturnType<typeof createApp>,
  origin?: string,
): Promise<boolean> => {
  const originHandler = app.locals.corsOptions?.origin;
  if (typeof originHandler !== 'function') {
    throw new TypeError('CORS origin handler is not available');
  }

  return new Promise<boolean>((resolve, reject) => {
    originHandler(origin, (error: Error | null, allowed: boolean) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Boolean(allowed));
    });
  });
};

describe.sequential('CORS Integration', () => {
  const originalCorsOrigins = process.env['CORS_ORIGINS'];

  beforeEach(() => {
    delete process.env['CORS_ORIGINS'];
  });

  afterEach(() => {
    if (originalCorsOrigins === undefined) {
      delete process.env['CORS_ORIGINS'];
      return;
    }
    process.env['CORS_ORIGINS'] = originalCorsOrigins;
  });

  it('allows requests without an Origin header', async () => {
    const app = createApp(testConfig);
    const { res } = await invokeApp(app, { method: 'GET', url: '/status' });

    expect(res.statusCode).toBe(200);
    expect(await resolveCorsOrigin(app)).toBe(true);
    expect(res._getHeaders()['access-control-allow-origin']).toBeUndefined();
  });

  it('normalizes CORS_ORIGINS values before allowlist matching', async () => {
    process.env['CORS_ORIGINS'] = 'https://allowed.example.com/,not-a-url';
    const app = createApp(testConfig);
    expect(await resolveCorsOrigin(app, 'https://allowed.example.com')).toBe(true);
  });

  it('rejects disallowed origins without returning a server error', async () => {
    process.env['CORS_ORIGINS'] = 'https://allowed.example.com';
    const app = createApp(testConfig);
    expect(await resolveCorsOrigin(app, 'https://blocked.example.com')).toBe(false);
    const { res } = await invokeApp(app, {
      method: 'GET',
      url: '/status',
      headers: { origin: 'https://blocked.example.com' },
    });

    expect(res.statusCode).toBe(200);
    expect(res._getHeaders()['access-control-allow-origin']).toBeUndefined();
  });
});

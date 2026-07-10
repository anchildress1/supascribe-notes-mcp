import { describe, it, expect } from 'vitest';
import { Script } from 'node:vm';
import { renderAuthPage } from '../../../src/views/auth-view.js';
import type { Config } from '../../../src/config.js';

describe('Auth View', () => {
  it('renders auth page with correct config', () => {
    const config: Config = {
      port: 3000,
      supabaseUrl: 'https://test.supabase.co',
      supabaseServiceRoleKey: 'test-key',
      supabaseAnonKey: 'anon-key',
      publicUrl: 'http://localhost:3000',
      serverVersion: '1.0.0',
    };

    const html = renderAuthPage(config);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Authorize App');
    expect(html).toContain('https://test.supabase.co');
    expect(html).toContain('anon-key');
    expect(html).toContain('id="email-input"');
    expect(html).toContain('id="password-input"');
    expect(html).toContain('signInWithPassword()');
    expect(html).toContain('signInWithPassword({ email, password })');
    expect(html).toContain("signIn('google')");
    expect(html).toContain("signIn('github')");
  });

  it('offers no cross-origin sign-in affordances', () => {
    const config: Config = {
      port: 3000,
      supabaseUrl: 'https://test.supabase.co',
      supabaseServiceRoleKey: 'test-key',
      supabaseAnonKey: 'anon-key',
      publicUrl: 'http://localhost:3000',
      serverVersion: '1.0.0',
    };

    const html = renderAuthPage(config);

    // A session written by another origin is unreachable here, so the page must not
    // imply otherwise. The storage listener also keyed off auth-js's raw STORAGE_KEY,
    // which createClient overrides to `sb-<ref>-auth-token` — it could never fire.
    expect(html).not.toContain('I signed in in another tab');
    expect(html).not.toContain('same origin');
    expect(html).not.toContain('refreshSession');
    expect(html).not.toContain('supabase.auth.token');
  });

  it('safely escapes config values that would otherwise break the inline script', () => {
    const config: Config = {
      port: 3000,
      supabaseUrl: 'https://test.supabase.co',
      supabaseServiceRoleKey: 'test-key',
      // Simulates a secret pasted with a trailing newline and an embedded quote —
      // exactly the shape that broke unescaped string concatenation in production.
      supabaseAnonKey: "anon-key-with-a-'quote'\nand-a-newline",
      publicUrl: 'http://localhost:3000',
      serverVersion: '1.0.0',
    };

    const html = renderAuthPage(config);
    const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    const dynamicScript = scriptBlocks.at(-1)?.[1];
    expect(dynamicScript).toBeDefined();

    // Script compiles (parses) the source without executing it — proves syntax
    // validity only, no code-execution surface.
    expect(() => new Script(dynamicScript as string)).not.toThrow();
  });
});

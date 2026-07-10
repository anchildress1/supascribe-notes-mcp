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
    expect(html).toContain('This page auto-detects new sessions.');
    expect(html).toContain('I signed in in another tab');
    expect(html).toContain('id="email-input"');
    expect(html).toContain('id="password-input"');
    expect(html).toContain('signInWithPassword()');
    expect(html).toContain('signInWithPassword({ email, password })');
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

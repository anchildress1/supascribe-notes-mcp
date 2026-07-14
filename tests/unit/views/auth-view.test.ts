import { describe, it, expect } from 'vitest';
import { Script } from 'node:vm';
import { renderAuthPage } from '../../../src/views/auth-view.js';
import type { Config } from '../../../src/config.js';

const baseConfig: Config = {
  port: 3000,
  supabaseUrl: 'https://test.supabase.co',
  supabaseServiceRoleKey: 'test-key',
  supabaseAnonKey: 'anon-key',
  publicUrl: 'http://localhost:3000',
  serverVersion: '1.0.0',
};

// The dynamic inline <script> is always the last one in the page; earlier
// <script> tags (the SDK loader, the error-handler shim) are static.
function getDynamicScript(html: string): string {
  const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  const dynamicScript = scriptBlocks.at(-1)?.[1];
  expect(dynamicScript).toBeDefined();
  return dynamicScript as string;
}

describe('Auth View', () => {
  it('renders auth page with correct config', () => {
    const html = renderAuthPage(baseConfig);

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

  it('loads the Supabase SDK from a version-pinned CDN URL with subresource integrity', () => {
    const html = renderAuthPage(baseConfig);

    // A floating @2 tag silently upgrades the SDK on every load — a page that breaks
    // with zero repo changes. The pin + integrity make the dependency immutable; if the
    // version is ever bumped, the hash must be recomputed or the browser refuses the script.
    expect(html).toContain(
      'src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.98.0/dist/umd/supabase.js"',
    );
    expect(html).toContain(
      'integrity="sha384-NRo2jhGGHu91p1IOcVC3UWI5Vnd+xGXfD/8N7Hr9+aGTK0d/Pl0i+kUZsB/zIlrK"',
    );
    expect(html).toContain('crossorigin="anonymous"');
    expect(html).not.toContain('supabase-js@2"');
  });

  it('offers no cross-origin sign-in affordances', () => {
    const html = renderAuthPage(baseConfig);

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
      ...baseConfig,
      // Simulates a secret pasted with a trailing newline and an embedded quote —
      // exactly the shape that broke unescaped string concatenation in production.
      supabaseAnonKey: "anon-key-with-a-'quote'\nand-a-newline",
    };

    const html = renderAuthPage(config);
    const dynamicScript = getDynamicScript(html);

    // Script compiles (parses) the source without executing it — proves syntax
    // validity only, no code-execution surface.
    expect(() => new Script(dynamicScript)).not.toThrow();
  });

  it('escapes a literal </script> in a config value instead of letting it close the script tag early', () => {
    const config: Config = {
      ...baseConfig,
      // JSON.stringify escapes quotes/backslashes but not `<` — an unescaped
      // "</script>" here would terminate the real script tag early and let the
      // rest of the string render as raw HTML/script in the page.
      supabaseAnonKey: '</script><script>alert(1)</script>',
    };

    const html = renderAuthPage(config);

    expect(html).not.toContain('</script><script>alert(1)</script>');
    // Only `<` needs escaping — the HTML tokenizer recognizes a closing tag by the
    // `</` sequence, so breaking just that is sufficient; `>` is left as-is.
    expect(html).toContain('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');

    const dynamicScript = getDynamicScript(html);
    expect(() => new Script(dynamicScript)).not.toThrow();
  });
});

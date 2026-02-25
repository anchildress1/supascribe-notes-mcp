import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      include: [
        'src/config.ts',
        'src/lib/auth-provider.ts',
        'src/middleware/auth.ts',
        'src/schemas/card.ts',
        'src/tools/lookup-tools.ts',
        'src/tools/write-cards.ts',
      ],
      reporter: ['text', 'json-summary', 'lcov', 'clover', 'html'],
      thresholds: {
        perFile: true,
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
      },
    },
    env: {
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      MCP_AUTH_TOKEN: 'test-auth-token',
      PORT: '0',
    },
  },
});

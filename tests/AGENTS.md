# Test Conventions — supascribe-notes-mcp

These rules supplement the global `test-writer` skill. They define codebase-specific
patterns that every test in this repo must follow. Read this file alongside the skill
before writing or modifying any test.

---

## Stack

- **Framework:** Vitest v3 (`npm test`)
- **Coverage provider:** V8, thresholds at **85%** lines / functions / branches / statements
- **Config:** `vitest.config.ts` — never modify thresholds without explicit user direction
- **Coverage excluded:** `src/index.ts` only

---

## Directory Layout

```
tests/
  unit/
    config.test.ts
    server-errors.test.ts
    server-schema.test.ts
    cors.test.ts
    lib/          ← tests for src/lib/*
    middleware/   ← tests for src/middleware/*
    schemas/      ← tests for src/schemas/*
    tools/        ← tests for src/tools/*
    views/        ← tests for src/views/*
  integration/
    lookup-tools.test.ts
    mcp-server.test.ts
  helpers/
    http.ts       ← invokeApp, createMockRequest, createMockResponse
```

Unit tests live in `tests/unit/` mirroring `src/`. Integration tests live in
`tests/integration/`. Never put integration logic in a unit test file or vice versa.

---

## Mock Patterns

### Pattern A — Harness Factory (write / mutation tools)

Use when the handler writes to multiple Supabase tables. Expose all mocks via `_mocks`
so tests can assert call arguments without accessing the internals of the harness.

```typescript
type SupabaseHarness = SupabaseClient & {
  _mocks: {
    upsertMock: ReturnType<typeof vi.fn>;
    cardRevisionsInsertMock: ReturnType<typeof vi.fn>;
    generationRunsInsertMock: ReturnType<typeof vi.fn>;
    generationRunsUpdateEqMock: ReturnType<typeof vi.fn>;
  };
};

function createSupabaseHarness(options: HarnessOptions = {}): SupabaseHarness {
  // Route by table name in from(); expose all mocks via _mocks
}
```

See `tests/unit/tools/write-cards.test.ts` for the canonical implementation.

### Pattern B — Chainable Query Builder (read / search tools)

Use when the handler chains `.select().in().is().ilike().or()` etc. Every chain method
returns the same query object (thenable Promise). `setResult()` changes what resolves.

```typescript
const createQueryMock = (initialValue: unknown): QueryMock => { ... };
// setResult() lets you control the resolved value between tests
```

**Critical:** whenever the source code adds a new chain method (e.g., `.is()` for
`deleted_at`), add it to this mock immediately. Never work around a missing method
with a type cast.

See `tests/unit/tools/lookup-tools.test.ts` for the canonical implementation.

### Pattern C — Module Mock + Query Builder (integration tests)

Integration tests use `vi.mock('../../src/lib/supabase.js', ...)` at the module level.
The cards query builder in integration tests implements **real in-memory filter logic** —
not no-op stubs — so request-level assertions are meaningful.

```typescript
vi.mock('../../src/lib/supabase.js', () => ({
  createSupabaseClient: vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation((table: string) => { ... }),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { ... } }, error: null }) },
  }),
}));
```

**Every filter method the source code calls must actually filter the in-memory `result`
array.** A method that just returns `queryBuilder` without mutating `result` makes
integration assertions meaningless — tests will pass regardless of whether the filtering
code is correct or even present.

When the source code adds a new chain method (e.g., `.is('deleted_at', null)`), the
integration mock must filter accordingly:

```typescript
is: vi.fn().mockImplementation((col: string, val: unknown) => {
  if (col === 'deleted_at' && val === null) {
    result = result.filter((card) => card.deleted_at == null);
  }
  return queryBuilder;
}),
```

See `tests/integration/lookup-tools.test.ts` for the canonical implementation.

### Fixture Coverage for State Variants

When a feature has distinct record states (e.g., active vs. soft-deleted), the fixture
set must contain at least one record in **each** state. Tests must then assert:

1. The default path **excludes** the non-default state (e.g., deleted cards hidden)
2. The opt-in path **includes** it (e.g., `include_deleted: true` returns deleted cards)

A test that only exercises one state proves nothing about the other. If all fixtures are
in the default state, a bug that skips filtering entirely will still pass every assertion.

---

## Integration Test Boilerplate

Every integration test file needs this shape:

```typescript
const authHeaders = { authorization: 'Bearer test-token' };

const testConfig: Config = {
  supabaseUrl: 'http://localhost:54321',
  supabaseServiceRoleKey: 'test-key',
  supabaseAnonKey: 'anon-key',
  port: 0,
  publicUrl: 'http://localhost:0',
  serverVersion: '1.0.0',
};

describe('Feature Integration', () => {
  let app: ReturnType<typeof createApp>;
  beforeAll(async () => {
    app = createApp(testConfig);
  });
  // ...
});
```

Every authenticated route must have tests for all three cases:

1. No auth → 401
2. Valid auth + invalid body → 400 with `{ error: 'Validation failed' }`
3. Valid auth + valid body → 200 with the correct response shape

---

## Tool Result Helper

All tool handlers return `{ content: [{ type: 'text', text: JSON.stringify(...) }] }`.
Parse with the typed helper — never inline `JSON.parse`:

```typescript
const asTextJson = <T>(result: { content: Array<{ type: string; text: string }> }): T => {
  const text = result.content[0]?.type === 'text' ? result.content[0].text : '{}';
  return JSON.parse(text) as T;
};
```

---

## Naming Conventions

- Describe blocks: `'handleFooBar'` or `'Foo Integration Tests'`
- It blocks: `verb + object + condition` — e.g., `'excludes soft-deleted cards by default'`
- Harness variables: `supabase`, `mockSupabase`
- Fixture: `validCard` (shared `const` at describe scope, spread for variants)
- Auth header object: `authHeaders`

---

## Vitest-Specific Rules

- `beforeEach(() => vi.restoreAllMocks())` at the top of every `describe`
- `vi.stubEnv` / `vi.unstubAllEnvs()` for environment variable tests
- `describe.sequential` only when tests genuinely share stateful mocks in order
- `it.each` / `describe.each` for any test that repeats structure with varying input
- `vi.mocked(fn)` instead of `fn as MockedFunction<...>` casts

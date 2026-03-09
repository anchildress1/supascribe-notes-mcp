import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  handleLookupCardsById,
  handleLookupCategories,
  handleLookupProjects,
  handleLookupTags,
  handleSearchCards,
} from '../../../src/tools/lookup-tools.js';

type QueryMock = {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  contains: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  setResult: (value: unknown) => void;
};

const asTextJson = <T>(result: { content: Array<{ type: string; text: string }> }): T => {
  const text = result.content[0]?.type === 'text' ? result.content[0].text : '{}';
  return JSON.parse(text) as T;
};

const createQueryMock = (initialValue: unknown): QueryMock => {
  let result = initialValue;
  const from = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const inFn = vi.fn();
  const isFn = vi.fn();
  const ilike = vi.fn();
  const or = vi.fn();
  const contains = vi.fn();
  const maybeSingle = vi.fn().mockImplementation(async () => result);

  type ThenableQuery = Promise<unknown> & {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    or: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };

  let query: ThenableQuery;
  const makeQuery = (): ThenableQuery => {
    query = Object.assign(
      Promise.resolve().then(() => result),
      {
        select: select.mockImplementation(() => query),
        eq: eq.mockImplementation(() => query),
        in: inFn.mockImplementation(() => query),
        is: isFn.mockImplementation(() => query),
        ilike: ilike.mockImplementation(() => query),
        or: or.mockImplementation(() => query),
        contains: contains.mockImplementation(() => query),
        maybeSingle,
      },
    );
    return query;
  };

  from.mockImplementation(() => makeQuery());

  return {
    from,
    select,
    eq,
    in: inFn,
    is: isFn,
    ilike,
    or,
    contains,
    maybeSingle,
    setResult(value: unknown) {
      result = value;
    },
  };
};

const setQueryResult = (supabase: QueryMock, value: unknown) => {
  supabase.setResult(value);
};

const setTagResults = (
  supabase: QueryMock,
  resultsByTable: Record<string, { data: unknown[]; error: { message: string } | null }>,
) => {
  supabase.from.mockImplementation((table: string) => ({
    select: vi.fn().mockResolvedValue(resultsByTable[table] ?? { data: [], error: null }),
  }));
};

describe('Lookup Tools Unit Tests', () => {
  let mockSupabase: QueryMock;

  beforeEach(() => {
    mockSupabase = createQueryMock({ data: [], error: null });
  });

  it('handleLookupCardsById calls supabase correctly', async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    setQueryResult(mockSupabase, { data: [{ objectID: id }], error: null });

    const result = await handleLookupCardsById(mockSupabase as SupabaseClient, [id]);
    const body = asTextJson<{ cards: Array<{ objectID: string }> }>(result);

    expect(mockSupabase.from).toHaveBeenCalledWith('cards');
    expect(mockSupabase.in).toHaveBeenCalledWith('objectID', [id]);
    expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null);
    expect(body.cards).toEqual([{ objectID: id }]);
  });

  it('handleLookupCardsById returns error when query fails', async () => {
    setQueryResult(mockSupabase, { data: null, error: { message: 'boom' } });

    const result = await handleLookupCardsById(mockSupabase as SupabaseClient, [
      '88888888-8888-8888-8888-888888888888',
    ]);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Error: boom');
  });

  it('handleLookupCardsById falls back to an empty list when data is null', async () => {
    setQueryResult(mockSupabase, { data: null, error: null });

    const result = await handleLookupCardsById(mockSupabase as SupabaseClient, [
      '88888888-8888-8888-8888-888888888888',
    ]);

    const body = asTextJson<{ cards: unknown[] }>(result);
    expect(body.cards).toEqual([]);
  });

  it.each([
    {
      label: 'categories',
      handler: handleLookupCategories,
      table: 'unique_categories',
      column: 'category',
      resultKey: 'categories',
      rows: [{ category: 'Cat 1' }, { category: 'Cat 2' }],
      expected: ['Cat 1', 'Cat 2'],
    },
    {
      label: 'projects',
      handler: handleLookupProjects,
      table: 'unique_projects',
      column: 'project',
      resultKey: 'projects',
      rows: [{ project: 'P1' }, { project: 'P2' }],
      expected: ['P1', 'P2'],
    },
  ])(
    'handleLookup$label maps rows correctly',
    async ({ handler, table, column, resultKey, rows, expected }) => {
      setQueryResult(mockSupabase, { data: rows, error: null });

      const result = await handler(mockSupabase as SupabaseClient);
      const body = asTextJson<Record<string, string[]>>(result);

      expect(mockSupabase.from).toHaveBeenCalledWith(table);
      expect(mockSupabase.select).toHaveBeenCalledWith(column);
      expect(body[resultKey]).toEqual(expected);
    },
  );

  it.each([
    { handler: handleLookupCategories, message: 'categories failed' },
    { handler: handleLookupProjects, message: 'projects failed' },
  ])('lookup handler returns error when query fails', async ({ handler, message }) => {
    setQueryResult(mockSupabase, { data: [], error: { message } });

    const result = await handler(mockSupabase as SupabaseClient);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(message);
  });

  it('handleLookupTags merges lvl0 and lvl1 tags', async () => {
    setTagResults(mockSupabase, {
      unique_tags_lvl0: { data: [{ tag: 'T0' }], error: null },
      unique_tags_lvl1: { data: [{ tag: 'T1' }, { tag: 'T2' }], error: null },
    });

    const result = await handleLookupTags(mockSupabase as SupabaseClient);
    const body = asTextJson<{ tags: { lvl0: string[]; lvl1: string[] } }>(result);

    expect(mockSupabase.from).toHaveBeenCalledWith('unique_tags_lvl0');
    expect(mockSupabase.from).toHaveBeenCalledWith('unique_tags_lvl1');
    expect(body.tags.lvl0).toEqual(['T0']);
    expect(body.tags.lvl1).toEqual(['T1', 'T2']);
  });

  it.each([
    {
      name: 'lvl0',
      resultsByTable: {
        unique_tags_lvl0: { data: [], error: { message: 'lvl0 failed' } },
        unique_tags_lvl1: { data: [{ tag: 'ok' }], error: null },
      },
      message: 'lvl0 failed',
    },
    {
      name: 'lvl1',
      resultsByTable: {
        unique_tags_lvl0: { data: [{ tag: 'ok' }], error: null },
        unique_tags_lvl1: { data: [], error: { message: 'lvl1 failed' } },
      },
      message: 'lvl1 failed',
    },
  ])('handleLookupTags returns errors from $name query', async ({ resultsByTable, message }) => {
    setTagResults(mockSupabase, resultsByTable);

    const result = await handleLookupTags(mockSupabase as SupabaseClient);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(message);
  });

  it('handleSearchCards matches a card when keyword filters overlap', async () => {
    setQueryResult(mockSupabase, {
      data: [
        {
          objectID: '1',
          title: 'Faster Postgres Indexes',
          blurb: 'Reducing index bloat',
          fact: 'Index tuning reduced latency spikes in read queries',
          category: 'Knowledge Base',
          projects: ['Alpha Platform'],
          tags: { lvl0: ['Databases'], lvl1: ['Postgres'] },
        },
        {
          objectID: '2',
          title: 'Unrelated note',
          blurb: 'Something else',
          fact: 'No keyword overlap here',
          category: 'Other',
          projects: ['Beta'],
          tags: { lvl0: ['Misc'], lvl1: ['General'] },
        },
      ],
      error: null,
    });

    const result = await handleSearchCards(mockSupabase as SupabaseClient, {
      category: 'know',
      project: 'alpha',
      tag: 'postgres',
      fact: 'index latency',
    });
    const body = asTextJson<{ cards: Array<{ objectID: string; title: string }> }>(result);

    expect(mockSupabase.from).toHaveBeenCalledWith('cards');
    expect(mockSupabase.select).toHaveBeenCalledWith('*');
    expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null);
    expect(mockSupabase.ilike).toHaveBeenCalledWith('category', '%know%');
    expect(mockSupabase.or).toHaveBeenCalledTimes(1);
    expect(mockSupabase.or.mock.calls[0][0]).toContain('title.ilike.%index%');
    expect(mockSupabase.or.mock.calls[0][0]).toContain('fact.ilike.%latency%');
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0]).toEqual(
      expect.objectContaining({
        objectID: '1',
        title: 'Faster Postgres Indexes',
      }),
    );
  });

  it('handleSearchCards supports loose fact matching with partial keyword overlap', async () => {
    setQueryResult(mockSupabase, {
      data: [
        {
          objectID: '1',
          title: 'Distributed systems notes',
          blurb: 'Replica lag behaviors',
          fact: 'Latency improved after retry budget tuning',
          category: 'Reliability',
          projects: ['Core'],
          tags: { lvl0: ['Infra'], lvl1: ['SRE'] },
        },
      ],
      error: null,
    });

    const result = await handleSearchCards(mockSupabase as SupabaseClient, {
      fact: 'distributed latency quorum',
    });

    const body = asTextJson<{ cards: Array<{ objectID: string }> }>(result);
    expect(body.cards[0]).toEqual(expect.objectContaining({ objectID: '1' }));
  });

  it('handleSearchCards returns empty cards for unmatched keywords and null data fallback', async () => {
    const unmatchedCard = {
      objectID: '1',
      title: 'Backend card',
      blurb: 'Only backend',
      fact: 'Some backend detail',
      category: 'Engineering',
      projects: ['Platform'],
      tags: { lvl0: ['Backend'], lvl1: ['API'] },
    };

    for (const queryResult of [
      { data: [unmatchedCard], error: null },
      { data: null, error: null },
    ]) {
      setQueryResult(mockSupabase, queryResult);
      const result = await handleSearchCards(mockSupabase as SupabaseClient, {
        category: 'finance',
        tag: 'billing',
        project: 'payments',
        fact: 'invoice retry',
      });
      const body = asTextJson<{ cards: unknown[] }>(result);
      expect(body.cards).toEqual([]);
    }
  });

  it('handleSearchCards returns query errors from supabase', async () => {
    setQueryResult(mockSupabase, { data: null, error: { message: 'search failed' } });

    const result = await handleSearchCards(mockSupabase as SupabaseClient, { fact: 'latency' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('search failed');
  });

  it.each([{}, { category: '   ', tag: '   ', project: '   ', fact: '   ' }])(
    'handleSearchCards rejects empty/whitespace filters',
    async (filters) => {
      const result = await handleSearchCards(mockSupabase as SupabaseClient, filters);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('At least one search filter');
      expect(mockSupabase.from).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: 'missing category',
      filters: { category: 'knowledge' },
      card: { objectID: '1' },
    },
    {
      name: 'missing projects',
      filters: { project: 'alpha' },
      card: { objectID: '1', category: 'Knowledge' },
    },
    {
      name: 'missing tags',
      filters: { tag: 'postgres' },
      card: { objectID: '1', category: 'Knowledge', projects: ['Alpha'] },
    },
    {
      name: 'missing fact fields',
      filters: { fact: 'latency' },
      card: { objectID: '1', category: 'Knowledge', projects: ['Alpha'] },
    },
  ])('handleSearchCards handles $name as empty searchable text', async ({ filters, card }) => {
    setQueryResult(mockSupabase, { data: [card], error: null });

    const result = await handleSearchCards(mockSupabase as SupabaseClient, filters);
    const body = asTextJson<{ cards: unknown[] }>(result);

    expect(body.cards).toEqual([]);
  });

  it('handleSearchCards rejects fact filters with no usable tokens', async () => {
    setQueryResult(mockSupabase, {
      data: [{ objectID: '1', title: 'One letter', blurb: 'Tiny', fact: 'a i u e o' }],
      error: null,
    });

    const result = await handleSearchCards(mockSupabase as SupabaseClient, { fact: 'a i u e o' });
    const body = asTextJson<{ cards: unknown[] }>(result);

    expect(body.cards).toEqual([]);
  });
});

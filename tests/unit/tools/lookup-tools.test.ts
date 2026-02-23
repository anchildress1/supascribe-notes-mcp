import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleLookupCardsById,
  handleLookupCategories,
  handleLookupProjects,
  handleLookupTags,
  handleSearchCards,
} from '../../../src/tools/lookup-tools.js';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Lookup Tools Unit Tests', () => {
  type QueryMock = {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    contains: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
  };

  let mockSupabase: QueryMock;

  beforeEach(() => {
    const createQueryMock = (returnValue: unknown): QueryMock => {
      const mock: QueryMock = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(returnValue),
        then: vi.fn().mockImplementation((onfulfilled: (value: unknown) => unknown) => {
          return Promise.resolve(returnValue).then(onfulfilled);
        }),
      };
      return mock;
    };

    mockSupabase = createQueryMock({ data: [], error: null });
  });

  it('handleLookupCardsById calls supabase correctly', async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: [{ objectID: id }], error: null }).then(onfulfilled),
    );

    const result = await handleLookupCardsById(supabase as SupabaseClient, [id]);

    expect(supabase.from).toHaveBeenCalledWith('cards');
    expect(supabase.in).toHaveBeenCalledWith('objectID', [id]);
    expect(JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}')).toEqual({
      cards: [{ objectID: id }],
    });
  });

  it('handleLookupCardsById returns error when query fails', async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: { message: 'boom' } }).then(onfulfilled),
    );

    const result = await handleLookupCardsById(supabase as SupabaseClient, [id]);

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Error: boom');
  });

  it('handleLookupCardsById falls back to an empty list when data is null', async () => {
    const id = '88888888-8888-8888-8888-888888888888';
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onfulfilled),
    );

    const result = await handleLookupCardsById(supabase as SupabaseClient, [id]);

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: unknown[];
    };
    expect(body.cards).toEqual([]);
  });

  it('handleLookupCategories calls supabase correctly', async () => {
    const mockData = { data: [{ category: 'Cat 1' }, { category: 'Cat 2' }], error: null };
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve(mockData).then(onfulfilled),
    );

    const result = await handleLookupCategories(supabase as SupabaseClient);

    expect(supabase.from).toHaveBeenCalledWith('unique_categories');
    expect(supabase.select).toHaveBeenCalledWith('category');
    const json = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}');
    expect(json.categories).toEqual(['Cat 1', 'Cat 2']);
  });

  it('handleLookupCategories returns error when query fails', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: { message: 'categories failed' } }).then(onfulfilled),
    );

    const result = await handleLookupCategories(supabase as SupabaseClient);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('categories failed');
  });

  it('handleLookupProjects calls supabase correctly', async () => {
    const mockData = { data: [{ project: 'P1' }, { project: 'P2' }], error: null };
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve(mockData).then(onfulfilled),
    );

    const result = await handleLookupProjects(supabase as SupabaseClient);

    expect(supabase.from).toHaveBeenCalledWith('unique_projects');
    expect(supabase.select).toHaveBeenCalledWith('project');
    const json = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}');
    expect(json.projects.sort()).toEqual(['P1', 'P2'].sort());
  });

  it('handleLookupProjects returns error when query fails', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: [], error: { message: 'projects failed' } }).then(onfulfilled),
    );

    const result = await handleLookupProjects(supabase as SupabaseClient);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('projects failed');
  });

  it('handleLookupTags calls supabase correctly', async () => {
    const supabase = mockSupabase;
    supabase.from.mockImplementation((table: string) => {
      const data = table === 'unique_tags_lvl0' ? [{ tag: 'T0' }] : [{ tag: 'T1' }, { tag: 'T2' }];
      return {
        select: vi.fn().mockReturnThis(),
        then: vi
          .fn()
          .mockImplementation((onfulfilled: (value: unknown) => unknown) =>
            Promise.resolve({ data, error: null }).then(onfulfilled),
          ),
      };
    });

    const result = await handleLookupTags(supabase as SupabaseClient);

    expect(supabase.from).toHaveBeenCalledWith('unique_tags_lvl0');
    expect(supabase.from).toHaveBeenCalledWith('unique_tags_lvl1');
    const json = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}');
    expect(json.tags.lvl0).toEqual(['T0']);
    expect(json.tags.lvl1.sort()).toEqual(['T1', 'T2'].sort());
  });

  it('handleLookupTags returns error when either tag query fails', async () => {
    const supabase = mockSupabase;
    supabase.from.mockImplementation((table: string) => {
      if (table === 'unique_tags_lvl0') {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: { message: 'lvl0 failed' } }),
        };
      }
      if (table === 'unique_tags_lvl1') {
        return { select: vi.fn().mockResolvedValue({ data: [{ tag: 'ok' }], error: null }) };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const result = await handleLookupTags(supabase as SupabaseClient);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('lvl0 failed');
  });

  it('handleLookupTags returns error when lvl1 tag query fails', async () => {
    const supabase = mockSupabase;
    supabase.from.mockImplementation((table: string) => {
      if (table === 'unique_tags_lvl0') {
        return {
          select: vi.fn().mockResolvedValue({ data: [{ tag: 'ok' }], error: null }),
        };
      }
      if (table === 'unique_tags_lvl1') {
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: { message: 'lvl1 failed' } }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
    });

    const result = await handleLookupTags(supabase as SupabaseClient);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('lvl1 failed');
  });

  it('handleSearchCards calls supabase with filters', async () => {
    const filters = {
      category: 'know',
      project: 'alpha',
      tag: 'postgres',
      fact: 'index latency',
    };
    const mockData = {
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
    };
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve(mockData).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, filters);

    expect(supabase.from).toHaveBeenCalledWith('cards');
    expect(supabase.select).toHaveBeenCalledWith('*');
    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: Array<{ objectID: string; title: string; category: string }>;
    };
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].objectID).toBe('1');
    expect(body.cards[0].title).toBe('Faster Postgres Indexes');
    expect(body.cards[0].category).toBe('Knowledge Base');
  });

  it('handleSearchCards supports loose fact matching with partial keyword overlap', async () => {
    const supabase = mockSupabase;
    const mockData = {
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
    };
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve(mockData).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, {
      fact: 'distributed latency quorum',
    });

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: Array<{ objectID: string }>;
    };
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].objectID).toBe('1');
  });

  it('handleSearchCards returns empty list when keyword filters do not match', async () => {
    const supabase = mockSupabase;
    const mockData = {
      data: [
        {
          objectID: '1',
          title: 'Backend card',
          blurb: 'Only backend',
          fact: 'Some backend detail',
          category: 'Engineering',
          projects: ['Platform'],
          tags: { lvl0: ['Backend'], lvl1: ['API'] },
        },
      ],
      error: null,
    };
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve(mockData).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, {
      category: 'finance',
      tag: 'billing',
      project: 'payments',
      fact: 'invoice retry',
    });

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: Array<{ objectID: string }>;
    };
    expect(body.cards).toEqual([]);
  });

  it('handleSearchCards returns query error from supabase', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: { message: 'search failed' } }).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, { fact: 'latency' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('search failed');
  });

  it('handleSearchCards returns error for empty filters', async () => {
    const supabase = mockSupabase;

    const result = await handleSearchCards(supabase as SupabaseClient, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('At least one search filter');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('handleSearchCards treats whitespace-only filters as empty', async () => {
    const supabase = mockSupabase;

    const result = await handleSearchCards(supabase as SupabaseClient, {
      category: '   ',
      tag: '   ',
      project: '   ',
      fact: '   ',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('At least one search filter');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('handleSearchCards falls back to empty data when query returns null data and no error', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, { fact: 'latency' });

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: unknown[];
    };
    expect(body.cards).toEqual([]);
  });

  it('handleSearchCards treats missing card category as empty text for category filtering', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: [{ objectID: '1' }], error: null }).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, { category: 'knowledge' });

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: unknown[];
    };
    expect(body.cards).toEqual([]);
  });

  it('handleSearchCards treats missing project list as empty text for project filtering', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({ data: [{ objectID: '1', category: 'Knowledge' }], error: null }).then(
        onfulfilled,
      ),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, { project: 'alpha' });

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: unknown[];
    };
    expect(body.cards).toEqual([]);
  });

  it('handleSearchCards treats missing tag lists as empty text for tag filtering', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({
        data: [{ objectID: '1', category: 'Knowledge', projects: ['Alpha'] }],
        error: null,
      }).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, { tag: 'postgres' });

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: unknown[];
    };
    expect(body.cards).toEqual([]);
  });

  it('handleSearchCards treats missing fact text fields as empty for fact filtering', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({
        data: [{ objectID: '1', category: 'Knowledge', projects: ['Alpha'] }],
        error: null,
      }).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, { fact: 'latency' });

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: unknown[];
    };
    expect(body.cards).toEqual([]);
  });

  it('handleSearchCards rejects fact filters that tokenize to no valid keywords', async () => {
    const supabase = mockSupabase;
    supabase.then.mockImplementation((onfulfilled: (value: unknown) => unknown) =>
      Promise.resolve({
        data: [{ objectID: '1', title: 'One letter', blurb: 'Tiny', fact: 'a i u e o' }],
        error: null,
      }).then(onfulfilled),
    );

    const result = await handleSearchCards(supabase as SupabaseClient, { fact: 'a i u e o' });

    const body = JSON.parse(result.content[0].type === 'text' ? result.content[0].text : '{}') as {
      cards: unknown[];
    };
    expect(body.cards).toEqual([]);
  });
});

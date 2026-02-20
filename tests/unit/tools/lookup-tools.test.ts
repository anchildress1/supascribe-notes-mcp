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

  it('handleSearchCards returns error for empty filters', async () => {
    const supabase = mockSupabase;

    const result = await handleSearchCards(supabase as SupabaseClient, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('At least one search filter');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

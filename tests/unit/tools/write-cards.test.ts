import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CardInput } from '../../../src/schemas/card.js';
import { handleWriteCards } from '../../../src/tools/write-cards.js';

type SelectResult = { data: unknown; error: null | { message: string } };
type UpsertResult = { error: null | { message: string } };
type InsertResult = { error: null | { message: string } };
type UpdateResult = { error: null | { message: string } };

type SupabaseHarness = SupabaseClient & {
  _mocks: {
    selectMock: ReturnType<typeof vi.fn>;
    maybeSingleMock: ReturnType<typeof vi.fn>;
    upsertMock: ReturnType<typeof vi.fn>;
    cardRevisionsInsertMock: ReturnType<typeof vi.fn>;
    generationRunsInsertMock: ReturnType<typeof vi.fn>;
    generationRunsUpdateMock: ReturnType<typeof vi.fn>;
    generationRunsUpdateEqMock: ReturnType<typeof vi.fn>;
  };
};

type HarnessOptions = {
  selectResult?: SelectResult;
  upsertResult?: UpsertResult;
  cardRevisionsInsertResult?: InsertResult;
  generationRunsInsertResult?: InsertResult;
  generationRunsUpdateResult?: UpdateResult;
  upsertMock?: ReturnType<typeof vi.fn>;
  generationRunsInsertMock?: ReturnType<typeof vi.fn>;
  generationRunsUpdateEqMock?: ReturnType<typeof vi.fn>;
};

const asTextJson = (result: { content: Array<{ type: string; text: string }> }) => {
  return JSON.parse(result.content[0]?.type === 'text' ? result.content[0].text : '{}') as Record<
    string,
    unknown
  >;
};

function createSupabaseHarness(options: HarnessOptions = {}): SupabaseHarness {
  const maybeSingleMock = vi
    .fn()
    .mockResolvedValue(options.selectResult ?? { data: null, error: null });
  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: maybeSingleMock,
    }),
  });

  const upsertMock =
    options.upsertMock ?? vi.fn().mockResolvedValue(options.upsertResult ?? { error: null });
  const cardRevisionsInsertMock = vi
    .fn()
    .mockResolvedValue(options.cardRevisionsInsertResult ?? { error: null });
  const generationRunsInsertMock =
    options.generationRunsInsertMock ??
    vi.fn().mockResolvedValue(options.generationRunsInsertResult ?? { error: null });
  const generationRunsUpdateEqMock =
    options.generationRunsUpdateEqMock ??
    vi.fn().mockResolvedValue(options.generationRunsUpdateResult ?? { error: null });
  const generationRunsUpdateMock = vi.fn().mockReturnValue({
    eq: generationRunsUpdateEqMock,
  });

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'cards') {
        return { select: selectMock, upsert: upsertMock };
      }
      if (table === 'card_revisions') {
        return { insert: cardRevisionsInsertMock };
      }
      if (table === 'generation_runs') {
        return { insert: generationRunsInsertMock, update: generationRunsUpdateMock };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    }),
    _mocks: {
      selectMock,
      maybeSingleMock,
      upsertMock,
      cardRevisionsInsertMock,
      generationRunsInsertMock,
      generationRunsUpdateMock,
      generationRunsUpdateEqMock,
    },
  } as unknown as SupabaseHarness;
}

const validCard: CardInput = {
  title: 'Test Card',
  blurb: 'A test blurb',
  fact: 'An interesting fact',
  tags: { lvl0: ['tech'] },
  projects: ['project-a'],
  category: 'reference',
  signal: 3,
};

describe('handleWriteCards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a new card successfully', async () => {
    const supabase = createSupabaseHarness();
    const result = await handleWriteCards(supabase, [validCard]);
    const body = asTextJson(result);

    expect(body.written).toBe(1);
    expect(body.errors).toBe(0);
    expect((body.results as Array<{ status: string }>)?.[0]?.status).toBe('created');
    expect((body.results as Array<{ title: string }>)?.[0]?.title).toBe('Test Card');
    expect(body.run_id).toBeDefined();
  });

  it('updates an existing card', async () => {
    const supabase = createSupabaseHarness({
      selectResult: { data: { objectID: '550e8400-e29b-41d4-a716-446655440000' }, error: null },
    });
    const card = { ...validCard, objectID: '550e8400-e29b-41d4-a716-446655440000' };

    const result = await handleWriteCards(supabase, [card]);
    const body = asTextJson(result);

    expect((body.results as Array<{ status: string }>)?.[0]?.status).toBe('updated');
  });

  it('handles upsert failure gracefully', async () => {
    const supabase = createSupabaseHarness({
      upsertResult: { error: { message: 'Constraint violation' } },
    });

    const result = await handleWriteCards(supabase, [validCard]);
    const body = asTextJson(result);

    expect(body.written).toBe(0);
    expect(body.errors).toBe(1);
    expect((body.error_details as string[])?.[0]).toContain('Constraint violation');
  });

  it('handles multiple cards with mixed results', async () => {
    let callCount = 0;
    const upsertMock = vi.fn().mockImplementation(() => {
      callCount += 1;
      return Promise.resolve(callCount === 2 ? { error: { message: 'Failed' } } : { error: null });
    });
    const supabase = createSupabaseHarness({ upsertMock });

    const result = await handleWriteCards(supabase, [
      { ...validCard, title: 'Card 1' },
      { ...validCard, title: 'Card 2' },
    ]);
    const body = asTextJson(result);

    expect(body.written).toBe(1);
    expect(body.errors).toBe(1);
  });

  it('handles card without optional url', async () => {
    const supabase = createSupabaseHarness();
    const cardWithoutUrl = { ...validCard } as CardInput;
    delete (cardWithoutUrl as Record<string, unknown>).url;

    const result = await handleWriteCards(supabase, [cardWithoutUrl]);
    const body = asTextJson(result);
    expect(body.written).toBe(1);
  });

  it('returns error details when card processing throws unexpectedly', async () => {
    const supabase = {
      from: vi.fn().mockImplementation(() => {
        throw new Error('Database down');
      }),
    } as unknown as SupabaseClient;

    const result = await handleWriteCards(supabase, [validCard]);
    const body = asTextJson(result);

    expect(result.isError).toBe(true);
    expect(body.written).toBe(0);
    expect(body.errors).toBe(1);
    expect((body.error_details as string[])?.[0]).toContain('Database down');
  });

  it('normalizes provided created_at for historical uploads', async () => {
    const supabase = createSupabaseHarness();

    await handleWriteCards(supabase, [{ ...validCard, created_at: '2020-01-01T00:00:00-05:00' }]);

    const upsertPayload = supabase._mocks.upsertMock.mock.calls[0]?.[0] as Record<string, string>;
    expect(upsertPayload.created_at).toBe('2020-01-01T05:00:00.000Z');
  });

  it('omits created_at when not provided to allow database default', async () => {
    const supabase = createSupabaseHarness();

    await handleWriteCards(supabase, [validCard]);

    const upsertPayload = supabase._mocks.upsertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(upsertPayload).not.toHaveProperty('created_at');
  });

  it('creates generation run before writing revisions', async () => {
    const supabase = createSupabaseHarness();

    await handleWriteCards(supabase, [validCard]);

    expect(supabase._mocks.generationRunsInsertMock).toHaveBeenCalledTimes(1);
    expect(supabase._mocks.cardRevisionsInsertMock).toHaveBeenCalledTimes(1);
    expect(supabase._mocks.generationRunsInsertMock.mock.invocationCallOrder[0]).toBeLessThan(
      supabase._mocks.cardRevisionsInsertMock.mock.invocationCallOrder[0],
    );
  });

  it('records revision insertion failures without failing the whole write', async () => {
    const supabase = createSupabaseHarness({
      cardRevisionsInsertResult: { error: { message: 'revision failed' } },
    });

    const result = await handleWriteCards(supabase, [validCard]);
    const body = asTextJson(result);

    expect(body.written).toBe(1);
    expect(body.errors).toBe(1);
    expect((body.error_details as string[])?.[0]).toContain(
      'Revision for "Test Card": revision failed',
    );
  });

  it('finalizes run through insert path when initial generation run insert reports error', async () => {
    let insertCount = 0;
    const generationRunsInsertMock = vi.fn().mockImplementation(() => {
      insertCount += 1;
      return Promise.resolve(
        insertCount === 1 ? { error: { message: 'initial insert failed' } } : { error: null },
      );
    });
    const supabase = createSupabaseHarness({ generationRunsInsertMock });

    const result = await handleWriteCards(supabase, [validCard]);
    const body = asTextJson(result);

    expect(body.written).toBe(1);
    expect(insertCount).toBe(2);
  });

  it('returns catastrophic error payload when response serialization throws', async () => {
    const generationRunsUpdateEqMock = vi
      .fn()
      .mockRejectedValue(new Error('cannot persist run error'));
    const supabase = createSupabaseHarness({ generationRunsUpdateEqMock });

    const circularTitle: Record<string, unknown> = {};
    circularTitle.self = circularTitle;

    const result = await handleWriteCards(supabase, [
      { ...validCard, title: circularTitle as unknown as string },
    ]);
    const body = asTextJson(result);

    expect(result.isError).toBe(true);
    expect(String(body.error)).toContain('circular');
    expect(body.written).toBe(1);
    expect(generationRunsUpdateEqMock).toHaveBeenCalled();
  });

  it('persists catastrophic run state via insert when generation run was never created', async () => {
    let insertCount = 0;
    let finalInsertPayload: Record<string, unknown> | undefined;
    const generationRunsInsertMock = vi
      .fn()
      .mockImplementation((payload: Record<string, unknown>) => {
        insertCount += 1;
        if (insertCount === 1) {
          return Promise.resolve({ error: { message: 'initial insert failed' } });
        }
        finalInsertPayload = payload;
        return Promise.resolve({ error: null });
      });
    const supabase = createSupabaseHarness({ generationRunsInsertMock });

    const explodingCards = {
      length: 1,
      [Symbol.iterator]: () => {
        throw new Error('cards iterator exploded');
      },
    } as unknown as CardInput[];

    const result = await handleWriteCards(supabase, explodingCards);
    const body = asTextJson(result);

    expect(result.isError).toBe(true);
    expect(String(body.error)).toContain('cards iterator exploded');
    expect(insertCount).toBe(2);
    expect(finalInsertPayload?.status).toBe('error');
    expect(String(finalInsertPayload?.error)).toContain('cards iterator exploded');
  });
});

import { describe, it, expect } from 'vitest';
import {
  CardInputSchema,
  CardIdInputSchema,
  WriteCardsInputSchema,
  TagsSchema,
  SearchCardsInputSchema,
} from '../../../src/schemas/card.js';

describe('TagsSchema', () => {
  it('rejects empty object', () => {
    expect(() => TagsSchema.parse({})).toThrow();
  });

  it('rejects lvl0-only payloads', () => {
    expect(() => TagsSchema.parse({ lvl0: ['a', 'b'] })).toThrow();
  });

  it('accepts both lvl0 and lvl1', () => {
    const tags = { lvl0: ['tech'], lvl1: ['ai', 'ml'] };
    expect(TagsSchema.parse(tags)).toEqual(tags);
  });

  it('rejects unexpected keys to keep tag shape strict', () => {
    expect(() => TagsSchema.parse({ lvl0: ['tech'], extra: ['oops'] })).toThrow();
  });
});

describe('CardInputSchema', () => {
  const validCard = {
    title: 'Test Card',
    blurb: 'A test blurb',
    fact: 'An interesting fact',
    url: 'https://example.com',
    tags: { lvl0: ['tech'], lvl1: [] },
    projects: ['project-a'],
    category: 'reference',
    signal: 3,
  };

  it('accepts a valid card with all fields', () => {
    const result = CardInputSchema.parse(validCard);
    expect(result.title).toBe('Test Card');
    expect(result.signal).toBe(3);
    expect(result.tags).toEqual({ lvl0: ['tech'], lvl1: [] });
  });

  it('accepts a card without optional objectID', () => {
    const result = CardInputSchema.parse(validCard);
    expect(result.objectID).toBeUndefined();
  });

  it('accepts a valid objectID', () => {
    const card = { ...validCard, objectID: '550e8400-e29b-41d4-a716-446655440000' };
    const result = CardInputSchema.parse(card);
    expect(result.objectID).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts a card without url (optional)', () => {
    const { url: _, ...cardWithoutUrl } = validCard;
    const result = CardInputSchema.parse(cardWithoutUrl);
    expect(result.url).toBeUndefined();
  });

  it('normalizes blank url values to undefined', () => {
    const result = CardInputSchema.parse({ ...validCard, url: '   ' });
    expect(result.url).toBeUndefined();
  });

  it('accepts a card without projects (defaults to empty array)', () => {
    const { projects: _, ...cardWithoutProjects } = validCard;
    const result = CardInputSchema.parse(cardWithoutProjects);
    expect(result.projects).toEqual([]);
  });

  it('rejects empty title', () => {
    expect(() => CardInputSchema.parse({ ...validCard, title: '' })).toThrow();
  });

  it('rejects empty blurb', () => {
    expect(() => CardInputSchema.parse({ ...validCard, blurb: '' })).toThrow();
  });

  it('rejects empty fact', () => {
    expect(() => CardInputSchema.parse({ ...validCard, fact: '' })).toThrow();
  });

  it('rejects invalid url', () => {
    expect(() => CardInputSchema.parse({ ...validCard, url: 'not-a-url' })).toThrow();
  });

  it('rejects non-string url values', () => {
    expect(() => CardInputSchema.parse({ ...validCard, url: 123 as unknown as string })).toThrow();
  });

  it('rejects signal below 1', () => {
    expect(() => CardInputSchema.parse({ ...validCard, signal: 0 })).toThrow();
  });

  it('rejects signal above 5', () => {
    expect(() => CardInputSchema.parse({ ...validCard, signal: 6 })).toThrow();
  });

  it('rejects non-integer signal', () => {
    expect(() => CardInputSchema.parse({ ...validCard, signal: 2.5 })).toThrow();
  });

  it('rejects invalid objectID format', () => {
    expect(() => CardInputSchema.parse({ ...validCard, objectID: 'not-a-uuid' })).toThrow();
  });

  it('accepts empty created_at by defaulting it', () => {
    const result = CardInputSchema.parse({ ...validCard, created_at: '   ' });
    expect(result.created_at).toBeUndefined();
  });

  it('accepts created_at when provided', () => {
    const created_at = '2020-01-01T00:00:00Z';
    const result = CardInputSchema.parse({ ...validCard, created_at: `  ${created_at}  ` });
    expect(result.created_at).toBe(created_at);
  });

  it('rejects non-string created_at values', () => {
    expect(() =>
      CardInputSchema.parse({ ...validCard, created_at: 123 as unknown as string }),
    ).toThrow();
  });

  it('accepts deleted_at when provided', () => {
    const deleted_at = '2024-06-01T12:00:00Z';
    const result = CardInputSchema.parse({ ...validCard, deleted_at: `  ${deleted_at}  ` });
    expect(result.deleted_at).toBe(deleted_at);
  });

  it('omits deleted_at when not provided', () => {
    const result = CardInputSchema.parse(validCard);
    expect(result.deleted_at).toBeUndefined();
  });

  it('normalizes blank deleted_at to undefined', () => {
    const result = CardInputSchema.parse({ ...validCard, deleted_at: '   ' });
    expect(result.deleted_at).toBeUndefined();
  });

  it('rejects invalid deleted_at string', () => {
    expect(() => CardInputSchema.parse({ ...validCard, deleted_at: 'not-a-date' })).toThrow();
  });
});

describe('WriteCardsInputSchema', () => {
  const validCard = {
    title: 'Card',
    blurb: 'Blurb',
    fact: 'Fact',
    tags: { lvl0: [], lvl1: [] },
    category: 'test',
    signal: 1,
  };

  it('accepts an array with one card', () => {
    const result = WriteCardsInputSchema.parse({ cards: [validCard] });
    expect(result.cards).toHaveLength(1);
  });

  it('rejects empty cards array', () => {
    expect(() => WriteCardsInputSchema.parse({ cards: [] })).toThrow();
  });

  it('rejects more than 50 cards', () => {
    const cards = Array.from({ length: 51 }, () => validCard);
    expect(() => WriteCardsInputSchema.parse({ cards })).toThrow();
  });
});

describe('CardIdInputSchema', () => {
  const validId = '88888888-8888-8888-8888-888888888888';

  it('defaults include_deleted to false', () => {
    const result = CardIdInputSchema.parse({ ids: [validId] });
    expect(result.include_deleted).toBe(false);
  });

  it('accepts include_deleted: true', () => {
    const result = CardIdInputSchema.parse({ ids: [validId], include_deleted: true });
    expect(result.include_deleted).toBe(true);
  });

  it('rejects non-boolean include_deleted', () => {
    expect(() =>
      CardIdInputSchema.parse({ ids: [validId], include_deleted: 'yes' as unknown as boolean }),
    ).toThrow();
  });
});

describe('SearchCardsInputSchema', () => {
  it('accepts at least one filter', () => {
    const result = SearchCardsInputSchema.parse({ fact: 'distributed systems' });
    expect(result.fact).toBe('distributed systems');
  });

  it('accepts each supported keyword filter individually', () => {
    expect(SearchCardsInputSchema.parse({ category: 'engineering' }).category).toBe('engineering');
    expect(SearchCardsInputSchema.parse({ tag: 'postgres' }).tag).toBe('postgres');
    expect(SearchCardsInputSchema.parse({ project: 'core platform' }).project).toBe(
      'core platform',
    );
    expect(SearchCardsInputSchema.parse({ fact: 'retry budget' }).fact).toBe('retry budget');
  });

  it('rejects empty filters', () => {
    expect(() => SearchCardsInputSchema.parse({})).toThrow();
  });
});

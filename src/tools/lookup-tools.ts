import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../lib/logger.js';

export async function handleLookupCardsById(
  supabase: SupabaseClient,
  ids: string[],
): Promise<CallToolResult> {
  logger.info({ ids }, 'Looking up cards by ID list');
  const { data, error } = await supabase.from('cards').select('*').in('objectID', ids);

  if (error) {
    logger.error({ ids, error }, 'Error looking up cards by ID list');
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ cards: data ?? [] }) }],
  };
}

export async function handleLookupCategories(supabase: SupabaseClient): Promise<CallToolResult> {
  logger.info('Looking up unique categories');
  const { data, error } = await supabase.from('unique_categories').select('category');

  if (error) {
    logger.error({ error }, 'Error fetching unique categories');
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }

  const categories = data.map((c: { category: string }) => c.category);
  return { content: [{ type: 'text', text: JSON.stringify({ categories }) }] };
}

export async function handleLookupProjects(supabase: SupabaseClient): Promise<CallToolResult> {
  logger.info('Looking up unique projects');
  const { data, error } = await supabase.from('unique_projects').select('project');

  if (error) {
    logger.error({ error }, 'Error fetching unique projects');
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }

  const projects = data.map((c: { project: string }) => c.project);
  return { content: [{ type: 'text', text: JSON.stringify({ projects }) }] };
}

export async function handleLookupTags(supabase: SupabaseClient): Promise<CallToolResult> {
  logger.info('Looking up unique tags');
  const [lvl0Res, lvl1Res] = await Promise.all([
    supabase.from('unique_tags_lvl0').select('tag'),
    supabase.from('unique_tags_lvl1').select('tag'),
  ]);

  if (lvl0Res.error || lvl1Res.error) {
    const error = lvl0Res.error || lvl1Res.error;
    logger.error({ error }, 'Error fetching unique tags');
    return { content: [{ type: 'text', text: `Error: ${error?.message}` }], isError: true };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          tags: {
            lvl0: lvl0Res.data.map((t: { tag: string }) => t.tag),
            lvl1: lvl1Res.data.map((t: { tag: string }) => t.tag),
          },
        }),
      },
    ],
  };
}

export async function handleSearchCards(
  supabase: SupabaseClient,
  filters: {
    category?: string;
    tag?: string;
    project?: string;
    fact?: string;
  },
): Promise<CallToolResult> {
  const normalizeText = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  };

  const tokenize = (value: string) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length > 1);

  const escapeLikeToken = (value: string) =>
    value
      .replaceAll('\\', '\\\\')
      .replaceAll('%', '\\%')
      .replaceAll('_', '\\_')
      .replaceAll(',', '\\,')
      .replaceAll('(', '\\(')
      .replaceAll(')', '\\)');

  const looseKeywordMatch = (query: string, haystack: string, minimumRatio = 1): boolean => {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return false;

    const haystackLower = haystack.toLowerCase();
    const matchedTokenCount = queryTokens.filter((token) => haystackLower.includes(token)).length;
    const requiredMatches = Math.max(1, Math.ceil(queryTokens.length * minimumRatio));

    return matchedTokenCount >= requiredMatches;
  };

  type SearchableCard = {
    title?: string;
    blurb?: string;
    fact?: string;
    category?: string;
    projects?: string[];
    tags?: {
      lvl0?: string[];
      lvl1?: string[];
    };
    [key: string]: unknown;
  };

  const normalizedFilters = {
    category: normalizeText(filters.category),
    tag: normalizeText(filters.tag),
    project: normalizeText(filters.project),
    fact: normalizeText(filters.fact),
  };

  const hasFilter =
    Boolean(normalizedFilters.category) ||
    Boolean(normalizedFilters.tag) ||
    Boolean(normalizedFilters.project) ||
    Boolean(normalizedFilters.fact);

  if (!hasFilter) {
    return {
      content: [{ type: 'text', text: 'Error: At least one search filter must be provided.' }],
      isError: true,
    };
  }

  logger.info({ filters: normalizedFilters }, 'Searching cards');
  let query = supabase.from('cards').select('*');

  if (normalizedFilters.category) {
    for (const token of tokenize(normalizedFilters.category)) {
      query = query.ilike('category', `%${escapeLikeToken(token)}%`);
    }
  }

  if (normalizedFilters.fact) {
    const factTokens = tokenize(normalizedFilters.fact);
    if (factTokens.length > 0) {
      const factOrConditions = factTokens.flatMap((token) => {
        const escapedToken = escapeLikeToken(token);
        return [
          `title.ilike.%${escapedToken}%`,
          `blurb.ilike.%${escapedToken}%`,
          `fact.ilike.%${escapedToken}%`,
        ];
      });
      query = query.or(factOrConditions.join(','));
    }
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ filters: normalizedFilters, error }, 'Error searching cards');
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }

  const cards = (data ?? []) as SearchableCard[];
  const matchedCards = cards.filter((card) => {
    if (normalizedFilters.category) {
      const categoryText = card.category ?? '';
      if (!looseKeywordMatch(normalizedFilters.category, categoryText, 1)) return false;
    }

    if (normalizedFilters.project) {
      const projectText = (card.projects ?? []).join(' ');
      if (!looseKeywordMatch(normalizedFilters.project, projectText, 1)) return false;
    }

    if (normalizedFilters.tag) {
      const tagText = [...(card.tags?.lvl0 ?? []), ...(card.tags?.lvl1 ?? [])].join(' ');
      if (!looseKeywordMatch(normalizedFilters.tag, tagText, 1)) return false;
    }

    if (normalizedFilters.fact) {
      const factSearchText = `${card.title ?? ''} ${card.blurb ?? ''} ${card.fact ?? ''}`;
      if (!looseKeywordMatch(normalizedFilters.fact, factSearchText, 0.5)) return false;
    }

    return true;
  });

  return {
    content: [{ type: 'text', text: JSON.stringify({ cards: matchedCards }) }],
  };
}

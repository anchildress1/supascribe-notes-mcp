import * as z from 'zod';

const TagListSchema = z.array(z.string().trim().min(1, 'tag values must not be empty'));

const optionalTimestamp = (fieldName: string) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) return undefined;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      }
      return value;
    },
    z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: `${fieldName} must be a valid datetime string`,
      })
      .optional(),
  );

export const TagsSchema = z
  .object({
    lvl0: TagListSchema.describe(
      'Broad, high-level categories or extensive themes. E.g., "Engineering", "Design", "Product".',
    ),
    lvl1: TagListSchema.describe(
      'Specific, granular tags or sub-themes. E.g., "React", "User Research", "Q3 Goals".',
    ),
  })
  .strict()
  .describe(
    'Hierarchical tags for the card. Always provide explicit arrays for tags.lvl0 and tags.lvl1.',
  );

export const CardInputSchema = z.object({
  objectID: z
    .string()
    .uuid()
    .optional()
    .describe('UUID of the card. If not provided, a new one will be generated.'),
  title: z
    .string()
    .min(1, 'title is required')
    .describe('The title of the card. Should be concise and descriptive.'),
  blurb: z
    .string()
    .optional()
    .nullable()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    })
    .describe('A short summary or "tweet-sized" description of the card content. Optional.'),
  fact: z
    .string()
    .min(1, 'fact is required')
    .describe('The main content or body of the card. Can include markdown.'),
  url: z
    .preprocess((value) => {
      if (value === null || value === undefined) return undefined;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      }
      return value;
    }, z.string().url('url must be a valid URL').optional())
    .describe('Source URL associated with the card content.'),
  tags: TagsSchema,
  projects: z
    .array(z.string())
    .optional()
    .default([])
    .describe('List of project identifiers or names this card belongs to.'),
  category: z
    .string()
    .min(1, 'category is required')
    .describe('The primary category or type of the note.'),
  signal: z
    .number()
    .int()
    .min(1, 'signal must be between 1 and 10')
    .max(10, 'signal must be between 1 and 10')
    .describe('Relevance score or importance signal, from 1 (low) to 10 (high).'),
  created_at: optionalTimestamp('created_at').describe(
    'Optional historical creation timestamp. If provided, it will be normalized to ISO-8601 UTC before upsert.',
  ),
  deleted_at: optionalTimestamp('deleted_at').describe(
    'Optional soft-delete timestamp. If provided, the card is marked as deleted at that time. Omit to leave deletion status unchanged.',
  ),
});

export const WriteCardsInputSchema = z.object({
  cards: z
    .array(CardInputSchema)
    .min(1, 'At least one card is required')
    .max(50, 'Maximum 50 cards per request')
    .describe('Array of cards to create or update.'),
});

export const EmptyInputSchema = z.object({});

export const CardIdInputSchema = z
  .object({
    ids: z
      .array(z.string().uuid())
      .min(1, 'At least one card id is required')
      .max(50, 'Maximum 50 card ids per request')
      .describe('Array of card UUIDs to lookup.'),
    include_deleted: z
      .boolean()
      .optional()
      .default(false)
      .describe('When true, soft-deleted cards are included in results. Default: false.'),
  })
  .strict();

export const SearchCardsInputSchema = z
  .object({
    category: z
      .string()
      .trim()
      .min(1, 'category must not be empty')
      .optional()
      .describe('Keyword category search. Use short keywords only, not full sentences.'),
    tag: z
      .string()
      .trim()
      .min(1, 'tag must not be empty')
      .optional()
      .describe(
        'Keyword tag search across lvl0/lvl1 tags. Use concise keywords only (for example: "postgres", "workflow").',
      ),
    project: z
      .string()
      .trim()
      .min(1, 'project must not be empty')
      .optional()
      .describe('Keyword project search. Use short project keywords only.'),
    fact: z
      .string()
      .trim()
      .min(1, 'fact must not be empty')
      .optional()
      .describe(
        'Loose fact search over title, blurb, and fact content. Use keywords only (for example: "indexing latency"), not long questions.',
      ),
  })
  .refine(
    (data) =>
      Boolean(data.category) || Boolean(data.tag) || Boolean(data.project) || Boolean(data.fact),
    { message: 'At least one search filter must be provided.' },
  );

export type CardInput = z.infer<typeof CardInputSchema>;
export type WriteCardsInput = z.infer<typeof WriteCardsInputSchema>;
export type EmptyInput = z.infer<typeof EmptyInputSchema>;
export type CardIdInput = z.infer<typeof CardIdInputSchema>;
export type SearchCardsInput = z.infer<typeof SearchCardsInputSchema>;

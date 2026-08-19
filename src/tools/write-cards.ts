import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { CardInput } from '../schemas/card.js';
import { logger } from '../lib/logger.js';

interface WriteResult {
  objectID: string;
  title: string;
  status: 'created' | 'updated';
}

type GenerationRunState = {
  generationRunCreated: boolean;
  generationRunIdForRevisions: string | null;
};

type CardWriteOutcome = {
  result?: WriteResult;
  error?: string;
  hadUnexpectedError?: boolean;
};

type BatchWriteOutcome = {
  results: WriteResult[];
  errors: string[];
  hadUnexpectedError: boolean;
};

type CardRow = {
  objectID: string;
  title: string;
  blurb: string | null;
  fact: string;
  url: string | undefined;
  tags: CardInput['tags'];
  projects: CardInput['projects'];
  category: string;
  signal: number;
  created_at?: string;
  deleted_at?: string;
  updated_at: string;
};

function buildCardRow(card: CardInput, objectID: string): CardRow {
  const createdAtInput = typeof card.created_at === 'string' ? card.created_at.trim() : undefined;
  const createdAt = createdAtInput ? new Date(createdAtInput).toISOString() : undefined;
  const deletedAtInput = typeof card.deleted_at === 'string' ? card.deleted_at.trim() : undefined;
  const deletedAt = deletedAtInput ? new Date(deletedAtInput).toISOString() : undefined;
  const now = new Date().toISOString();

  return {
    objectID,
    title: card.title,
    blurb: card.blurb,
    fact: card.fact,
    url: card.url,
    tags: card.tags,
    projects: card.projects,
    category: card.category,
    signal: card.signal,
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(deletedAt ? { deleted_at: deletedAt } : {}),
    updated_at: now,
  };
}

async function createGenerationRun(
  supabase: SupabaseClient,
  runId: string,
): Promise<GenerationRunState> {
  try {
    const { error: runError } = await supabase.from('generation_runs').insert({
      id: runId,
      tool_name: 'write_cards',
      cards_written: 0,
      status: 'partial',
      error: null,
    });

    if (runError) {
      logger.error({ runId, error: runError }, 'Failed to create generation run');
      return {
        generationRunCreated: false,
        generationRunIdForRevisions: null,
      };
    }

    return {
      generationRunCreated: true,
      generationRunIdForRevisions: runId,
    };
  } catch (error) {
    logger.error({ runId, error }, 'Unexpected error creating generation run');
    return {
      generationRunCreated: false,
      generationRunIdForRevisions: null,
    };
  }
}

async function persistGenerationRun(
  supabase: SupabaseClient,
  runId: string,
  resultsCount: number,
  status: 'success' | 'partial' | 'error',
  error: string | null,
  generationRunCreated: boolean,
): Promise<void> {
  if (generationRunCreated) {
    const { error: updateError } = await supabase
      .from('generation_runs')
      .update({
        cards_written: resultsCount,
        status,
        error,
      })
      .eq('id', runId);

    if (updateError) {
      logger.error(
        { runId, resultsCount, status, error, supabaseError: updateError },
        'Failed to update generation run',
      );
      throw new Error(`Failed to update generation run: ${updateError.message}`);
    }
    return;
  }

  const { error: insertError } = await supabase.from('generation_runs').insert({
    id: runId,
    tool_name: 'write_cards',
    cards_written: resultsCount,
    status,
    error,
  });

  if (insertError) {
    logger.error(
      { runId, resultsCount, status, error, supabaseError: insertError },
      'Failed to insert generation run',
    );
    throw new Error(`Failed to insert generation run: ${insertError.message}`);
  }
}

async function writeSingleCard(
  supabase: SupabaseClient,
  runId: string,
  card: CardInput,
  generationRunIdForRevisions: string | null,
): Promise<CardWriteOutcome> {
  try {
    const objectID = card.objectID ?? randomUUID();
    const row = buildCardRow(card, objectID);

    const { data: existing } = await supabase
      .from('cards')
      .select('"objectID"')
      .eq('objectID', objectID)
      .maybeSingle();
    const isUpdate = Boolean(existing);

    const { error: upsertError } = await supabase
      .from('cards')
      .upsert(row, { onConflict: 'objectID' });
    if (upsertError) {
      const message = `Card "${card.title}": ${upsertError.message}`;
      logger.error({ runId, card: card.title, error: upsertError }, 'Failed to upsert card');
      return { error: message };
    }

    const { error: revisionError } = await supabase.from('card_revisions').insert({
      card_id: objectID,
      revision_data: row,
      generation_run_id: generationRunIdForRevisions,
    });
    if (revisionError) {
      return {
        result: {
          objectID,
          title: card.title,
          status: isUpdate ? 'updated' : 'created',
        },
        error: `Revision for "${card.title}": ${revisionError.message}`,
      };
    }

    return {
      result: {
        objectID,
        title: card.title,
        status: isUpdate ? 'updated' : 'created',
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error({ runId, card: card.title, error }, 'Unexpected error processing card');
    return {
      error: `Card "${card.title}": ${message}`,
      hadUnexpectedError: true,
    };
  }
}

async function writeCardsBatch(
  supabase: SupabaseClient,
  runId: string,
  cards: CardInput[],
  generationRunIdForRevisions: string | null,
): Promise<BatchWriteOutcome> {
  const results: WriteResult[] = [];
  const errors: string[] = [];
  let hadUnexpectedError = false;

  for (const card of cards) {
    const outcome = await writeSingleCard(supabase, runId, card, generationRunIdForRevisions);
    if (outcome.result) {
      results.push(outcome.result);
    }
    if (outcome.error) {
      errors.push(outcome.error);
    }
    if (outcome.hadUnexpectedError) {
      hadUnexpectedError = true;
    }
  }

  return { results, errors, hadUnexpectedError };
}

export async function handleWriteCards(
  supabase: SupabaseClient,
  cards: CardInput[],
): Promise<CallToolResult> {
  const runId = randomUUID();
  logger.info({ runId, cardCount: cards.length }, 'Starting write_cards execution');
  let generationRunCreated = false;
  let generationRunIdForRevisions: string | null = null;
  let writtenCount = 0;

  try {
    const generationRunState = await createGenerationRun(supabase, runId);
    generationRunCreated = generationRunState.generationRunCreated;
    generationRunIdForRevisions = generationRunState.generationRunIdForRevisions;

    const { results, errors, hadUnexpectedError } = await writeCardsBatch(
      supabase,
      runId,
      cards,
      generationRunIdForRevisions,
    );
    writtenCount = results.length;

    const finalStatus = errors.length > 0 ? 'partial' : 'success';
    const finalError = errors.length > 0 ? errors.join('; ') : null;

    try {
      await persistGenerationRun(
        supabase,
        runId,
        results.length,
        finalStatus,
        finalError,
        generationRunCreated,
      );
    } catch (error) {
      logger.error({ runId, error }, 'Failed to finalize generation run');
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            run_id: runId,
            written: results.length,
            errors: errors.length,
            results,
            ...(errors.length > 0 ? { error_details: errors } : {}),
          }),
        },
      ],
      isError: results.length === 0 && hadUnexpectedError,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Attempt to log failed run
    try {
      await persistGenerationRun(
        supabase,
        runId,
        writtenCount,
        'error',
        message,
        generationRunCreated,
      );
    } catch {
      // Swallow logging failure
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            run_id: runId,
            error: message,
            written: writtenCount,
          }),
        },
      ],
      isError: true,
    };
  }
}

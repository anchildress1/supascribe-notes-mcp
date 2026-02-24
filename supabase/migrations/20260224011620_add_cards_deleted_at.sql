-- Soft delete marker for cards
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

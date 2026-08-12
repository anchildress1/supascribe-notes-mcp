-- Widen the cards.signal range from 1-5 to 1-10 to allow finer-grained
-- relevance/importance scoring. Already applied remotely outside this repo;
-- added here so local migration history matches what's actually live.

ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_signal_check;

ALTER TABLE public.cards
  ADD CONSTRAINT cards_signal_check CHECK (signal >= 1 AND signal <= 10);

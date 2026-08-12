-- Widen the cards.signal range from 1-5 to 1-10 to allow finer-grained
-- relevance/importance scoring.

ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_signal_check;

ALTER TABLE public.cards
  ADD CONSTRAINT cards_signal_check CHECK (signal BETWEEN 1 AND 10);

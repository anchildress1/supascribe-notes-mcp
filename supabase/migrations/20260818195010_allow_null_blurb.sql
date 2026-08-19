-- blurb is no longer required. Postgres UNIQUE constraints already permit
-- multiple NULLs (NULL <> NULL), so cards_blurb_unique from
-- 009_add_unique_title_blurb.sql needs no change as long as empty blurbs are
-- stored as NULL rather than ''.

ALTER TABLE public.cards
  ALTER COLUMN blurb DROP NOT NULL;

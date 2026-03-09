-- Exclude soft-deleted cards from all discovery views.
-- Also guard tag array extraction against scalar values (fixes "cannot extract
-- elements from a scalar" error when tags.lvl0 / tags.lvl1 is not an array).

CREATE OR REPLACE VIEW public.unique_categories
  WITH (security_invoker = true, security_barrier = true)
AS
SELECT DISTINCT category
FROM public.cards
WHERE deleted_at IS NULL
ORDER BY category;

CREATE OR REPLACE VIEW public.unique_projects
  WITH (security_invoker = true, security_barrier = true)
AS
SELECT DISTINCT unnest(projects) AS project
FROM public.cards
WHERE projects IS NOT NULL
  AND deleted_at IS NULL
ORDER BY project;

CREATE OR REPLACE VIEW public.unique_tags_lvl0
  WITH (security_invoker = true, security_barrier = true)
AS
SELECT DISTINCT unnest(jsonb_array_cast(tags->'lvl0')) AS tag
FROM public.cards
WHERE tags ? 'lvl0'
  AND jsonb_typeof(tags->'lvl0') = 'array'
  AND deleted_at IS NULL
ORDER BY tag;

CREATE OR REPLACE VIEW public.unique_tags_lvl1
  WITH (security_invoker = true, security_barrier = true)
AS
SELECT DISTINCT unnest(jsonb_array_cast(tags->'lvl1')) AS tag
FROM public.cards
WHERE tags ? 'lvl1'
  AND jsonb_typeof(tags->'lvl1') = 'array'
  AND deleted_at IS NULL
ORDER BY tag;

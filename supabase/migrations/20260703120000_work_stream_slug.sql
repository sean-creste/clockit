-- Add a slug to work_streams (ARCHITECTURE.md §12: conventional-commit scope ->
-- work stream). Shown in the Clients & work streams admin design (e.g.
-- "Dashboard UI /dashboard-ui"). Backfill existing streams from their names.

alter table public.work_streams add column if not exists slug text;

update public.work_streams
set slug = trim(both '-' from lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')))
where slug is null;

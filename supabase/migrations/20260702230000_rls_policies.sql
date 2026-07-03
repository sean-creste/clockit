-- Creste "clockit" — RLS + role helper (ARCHITECTURE.md §6)
--
-- NOTE: `current_role` is a reserved PostgreSQL keyword. `create function
-- current_role()` and an unqualified `current_role()` are syntax errors, and a
-- bare `current_role` binds to the built-in session role. We therefore define
-- and call the helper SCHEMA-QUALIFIED as `public.current_role()` everywhere
-- (verified: schema-qualified create + call bind to this function).

-- ── role helper ──────────────────────────────────────────────────────────────
-- SECURITY DEFINER so it can read resources without tripping that table's RLS
-- (prevents policy recursion). STABLE + search_path hardening.
create or replace function public.current_role()
returns app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.resources where auth_user_id = (select auth.uid());
$$;

grant execute on function public.current_role() to anon, authenticated;

-- ── enable RLS ───────────────────────────────────────────────────────────────
alter table public.resources    enable row level security;
alter table public.clients      enable row level security;
alter table public.work_streams enable row level security;
alter table public.invoices     enable row level security;
alter table public.time_entries enable row level security;

-- ── cost_rate protection (deviation 4) ───────────────────────────────────────
-- RLS filters rows, not columns, and admins/members share the `authenticated`
-- Postgres role — so column privileges are the tool. Revoke table-wide SELECT
-- from anon/authenticated and re-grant every column EXCEPT cost_rate. Admin
-- cost/margin reads happen server-side via the service_role key (bypasses this).
revoke select on public.resources from anon, authenticated;
grant select (id, auth_user_id, email, role, name, title,
              default_bill_rate, active, created_at)
  on public.resources to anon, authenticated;

revoke select on public.time_entries from anon, authenticated;
grant select (id, resource_id, work_stream_id, entry_date, hours, description,
              bill_rate, billable, invoice_id, created_at, created_by)
  on public.time_entries to anon, authenticated;

-- ── resources policies ───────────────────────────────────────────────────────
-- Members read only their own resource row; admins read all. Only admins write.
create policy resources_select on public.resources
  for select to authenticated
  using ((select public.current_role()) = 'admin'
         or auth_user_id = (select auth.uid()));

create policy resources_admin_insert on public.resources
  for insert to authenticated
  with check ((select public.current_role()) = 'admin');

create policy resources_admin_update on public.resources
  for update to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

create policy resources_admin_delete on public.resources
  for delete to authenticated
  using ((select public.current_role()) = 'admin');

-- ── admin-only tables: clients / work_streams / invoices ─────────────────────
-- Members get no policy => default deny (cannot query them directly). The /time
-- dropdown is populated server-side (service_role), never by a member query.
create policy clients_admin_all on public.clients
  for all to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

create policy work_streams_admin_all on public.work_streams
  for all to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

create policy invoices_admin_all on public.invoices
  for all to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

-- ── time_entries policies ────────────────────────────────────────────────────
-- Helper: rows owned by the caller.
--   resource_id in (select id from resources where auth_user_id = auth.uid())
--
-- SELECT: members see all their own entries (invoiced ones render read-only in
-- the UI); admins see all. INSERT/UPDATE/DELETE: members only on their own
-- entries while invoice_id IS NULL (a billed row is locked); admins anything.
create policy time_entries_select on public.time_entries
  for select to authenticated
  using (
    (select public.current_role()) = 'admin'
    or resource_id in (select id from public.resources
                       where auth_user_id = (select auth.uid()))
  );

create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (
    (select public.current_role()) = 'admin'
    or (resource_id in (select id from public.resources
                        where auth_user_id = (select auth.uid()))
        and invoice_id is null)
  );

create policy time_entries_update on public.time_entries
  for update to authenticated
  using (
    (select public.current_role()) = 'admin'
    or (resource_id in (select id from public.resources
                        where auth_user_id = (select auth.uid()))
        and invoice_id is null)
  )
  with check (
    (select public.current_role()) = 'admin'
    or (resource_id in (select id from public.resources
                        where auth_user_id = (select auth.uid()))
        and invoice_id is null)
  );

create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (
    (select public.current_role()) = 'admin'
    or (resource_id in (select id from public.resources
                        where auth_user_id = (select auth.uid()))
        and invoice_id is null)
  );

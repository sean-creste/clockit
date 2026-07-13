-- Purchase Orders + signed agreements.
--
-- A PO belongs to a client, carries an authorized amount (for burn-down), and
-- can hold multiple signed-agreement documents. Time entries reference a PO so
-- hours can be attributed to the authorizing PO. Admin-only via RLS; members
-- get PO options server-curated (service role), like clients/work_streams.

create type po_status as enum ('draft', 'active', 'closed', 'cancelled');

create table purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  po_number   text not null,
  description text,
  amount      numeric(12,2),                 -- authorized cap (optional) -> burn-down
  currency    text not null default 'USD',
  issue_date  date,
  expiry_date date,
  status      po_status not null default 'active',
  created_at  timestamptz not null default now(),
  unique (client_id, po_number)
);

-- Multiple signed agreements / amendments per PO. Files live in the private
-- 'agreements' storage bucket; `path` is the object path.
create table po_documents (
  id          uuid primary key default gen_random_uuid(),
  po_id       uuid not null references purchase_orders(id) on delete cascade,
  name        text not null,
  path        text not null,
  mime_type   text,
  size_bytes  bigint,
  uploaded_by uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

-- Tag time entries with the authorizing PO (nullable; "required when the client
-- has an active PO" is enforced in the app on insert).
alter table time_entries add column po_id uuid references purchase_orders(id);

create index purchase_orders_client_id_idx on purchase_orders (client_id);
create index po_documents_po_id_idx       on po_documents (po_id);
create index time_entries_po_id_idx        on time_entries (po_id);

-- ── RLS: admin-only (members never query POs directly) ───────────────────────
alter table purchase_orders enable row level security;
alter table po_documents    enable row level security;

create policy po_admin_all on purchase_orders
  for all to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

create policy po_docs_admin_all on po_documents
  for all to authenticated
  using ((select public.current_role()) = 'admin')
  with check ((select public.current_role()) = 'admin');

-- ── private storage bucket for signed agreements ─────────────────────────────
-- No storage.objects policies -> anon/authenticated have no access; the app
-- uploads/reads server-side with the service role (which bypasses storage RLS).
insert into storage.buckets (id, name, public)
values ('agreements', 'agreements', false)
on conflict (id) do nothing;

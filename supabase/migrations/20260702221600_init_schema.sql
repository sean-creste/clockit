-- Creste "clockit" — initial schema (ARCHITECTURE.md §3)
--
-- Table order is dependency-driven (differs from the doc's listing order):
--   resources -> clients -> work_streams -> invoices -> time_entries
-- because time_entries.invoice_id references invoices(id).
--
-- Deviation from §3: resources gains an `email` column (unique) so auth.users
-- can be linked to a resource by email on first sign-in (see Phase 3).

-- ── enums ────────────────────────────────────────────────────────────────────
create type app_role as enum ('admin', 'member');
create type engagement_type as enum ('hourly', 'retainer', 'fixed_fee', 'equity');
create type invoice_status as enum ('draft', 'issued', 'paid', 'void');

-- ── resources: who does the work (links to Supabase auth) ────────────────────
create table resources (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid references auth.users(id) on delete set null,
  email              text unique,                   -- for email->resource linking on first sign-in
  role               app_role not null default 'member',
  name               text not null,
  title              text,                          -- "Founding Partner", "Engineer"
  cost_rate          numeric(10,2),                 -- what Creste PAYS (admin-only, margin)
  default_bill_rate  numeric(10,2),                 -- what a client is charged by default
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ── clients: who we bill ─────────────────────────────────────────────────────
create table clients (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  legal_name         text,
  currency           text not null default 'USD',
  engagement         engagement_type not null default 'hourly',
  retainer_amount    numeric(12,2),                 -- used when engagement = retainer
  fixed_fee_amount   numeric(12,2),                 -- used when engagement = fixed_fee
  payment_terms_days int not null default 30,       -- net-30
  billing_email      text,
  billing_address    jsonb,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ── work_streams: the billable buckets under a client ────────────────────────
create table work_streams (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  name          text not null,                      -- "Dashboard UI", "ETL", "Fetch API"
  budget_hours  numeric(10,2),
  budget_amount numeric(12,2),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── invoices (created before time_entries for the FK) ────────────────────────
create table invoices (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id),
  invoice_number text not null unique,              -- CRESTE-2026-001
  period_start   date not null,
  period_end     date not null,
  issue_date     date not null,
  due_date       date not null,
  currency       text not null default 'USD',
  subtotal       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  status         invoice_status not null default 'draft',
  pdf_path       text,                              -- storage path once rendered
  created_at     timestamptz not null default now()
);

-- ── time_entries: the fact table ─────────────────────────────────────────────
create table time_entries (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid not null references resources(id),
  work_stream_id uuid not null references work_streams(id),
  entry_date     date not null,
  hours          numeric(5,2) not null check (hours > 0 and hours <= 24),
  description    text,
  bill_rate      numeric(10,2) not null,            -- SNAPSHOT at insert
  cost_rate      numeric(10,2),                     -- SNAPSHOT at insert (margin)
  billable       boolean not null default true,
  invoice_id     uuid references invoices(id),      -- NULL = uninvoiced (idempotency guard)
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id)
);

-- ── indexes ──────────────────────────────────────────────────────────────────
create index time_entries_work_stream_id_idx on time_entries (work_stream_id);
create index time_entries_invoice_id_idx     on time_entries (invoice_id);
create index time_entries_entry_date_idx     on time_entries (entry_date);
create index work_streams_client_id_idx      on work_streams (client_id);

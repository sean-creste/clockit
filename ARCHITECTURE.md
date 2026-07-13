# Creste — Time & Invoicing System

**Repo owner:** sean@creste.dev · **Data:** Supabase (Creste org) · **Deploy:** Cloudflare Workers

A time-tracking and invoicing system for a small, growing studio. Resources log hours
against client work streams. On the first business day of each month, the system generates
one invoice per client for the prior month, plus an itemized report broken down by work
stream and by resource.

---

## 1. What this is (and isn't)

The current spreadsheet is a **personal pace tracker** — time-ordered, optimized for "am I
on track this month." This system answers a **billing** question: "what do I invoice each
client, and can I show them exactly who did what, on which work stream." The primary axis is
`client → work stream → resource`, not time.

The pace instinct isn't lost — it comes back at team scale in the dashboard (Section 8) as
utilization and margin.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | Standard, agent-friendly, portable |
| Deploy | Cloudflare Workers via `@opennextjs/cloudflare` (1.0 GA, Feb 2026) | DNS + billing already on Cloudflare; one platform |
| DB / Auth | Supabase (Postgres + RLS + Auth) | Already connected; RLS is the security model |
| Scheduling | Supabase Cron (`pg_cron`) → **database function** | Money logic stays in-DB, transactional, no HTTP |
| PDF | `@react-pdf/renderer` | Pixel control for the branded oxblood invoice |
| Styling | Tailwind + shared brand tokens | CRESTE wordmark, oxblood accent |

**Deploy decision rule:** default to Cloudflare via OpenNext. The adapter trails new Next.js
features and `next/image` needs a custom loader on Workers. If it fights you during Phase 0
scaffolding, fall back to Vercel — **the application code is identical**; only the deploy
config changes. Don't burn a day fighting the adapter before there's an app to deploy.

---

## 3. Data model

Four core tables plus `invoices`. Two non-negotiable invariants:

1. **Snapshot rates onto each time entry.** A future rate change must never silently rewrite
   a past invoice.
2. **`invoice_id` on a time entry is the idempotency guard.** An entry belongs to at most one
   invoice, so it can't be double-billed. `NULL` = uninvoiced.

```sql
-- roles
create type app_role as enum ('admin', 'member');
create type engagement_type as enum ('hourly', 'retainer', 'fixed_fee', 'equity');
create type invoice_status as enum ('draft', 'issued', 'paid', 'void');

-- who does the work (links to Supabase auth, nullable for non-login resources)
create table resources (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid references auth.users(id) on delete set null,
  role               app_role not null default 'member',
  name               text not null,
  title              text,                         -- "Founding Partner", "Engineer"
  cost_rate          numeric(10,2),                -- what Creste PAYS (admin-only, margin)
  default_bill_rate  numeric(10,2),                -- what a client is charged by default
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- who we bill
create table clients (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  legal_name         text,
  currency           text not null default 'USD',
  engagement         engagement_type not null default 'hourly',
  retainer_amount    numeric(12,2),                -- used when engagement = retainer
  fixed_fee_amount   numeric(12,2),                -- used when engagement = fixed_fee
  payment_terms_days int not null default 30,      -- net-30
  billing_email      text,
  billing_address    jsonb,
  active             boolean not null default true,
  created_at         timestamptz not null default now()
);

-- the billable buckets under a client
create table work_streams (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  name          text not null,                     -- "Dashboard UI", "ETL", "Fetch API"
  budget_hours  numeric(10,2),
  budget_amount numeric(12,2),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- the fact table
create table time_entries (
  id             uuid primary key default gen_random_uuid(),
  resource_id    uuid not null references resources(id),
  work_stream_id uuid not null references work_streams(id),
  entry_date     date not null,
  hours          numeric(5,2) not null check (hours > 0 and hours <= 24),
  description    text,
  bill_rate      numeric(10,2) not null,           -- SNAPSHOT at insert
  cost_rate      numeric(10,2),                    -- SNAPSHOT at insert (margin)
  billable       boolean not null default true,
  invoice_id     uuid references invoices(id),     -- NULL = uninvoiced (idempotency guard)
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id)
);

create table invoices (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references clients(id),
  invoice_number text not null unique,             -- CRESTE-2026-001
  period_start   date not null,
  period_end     date not null,
  issue_date     date not null,
  due_date       date not null,
  currency       text not null default 'USD',
  subtotal       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  status         invoice_status not null default 'draft',
  pdf_path       text,                             -- storage path once rendered
  created_at     timestamptz not null default now()
);
```

**One entry, one work stream.** Drop the current `"Development & Fetch & Meeting"` ampersand
tagging — it can't be cleanly split across streams, and per-stream reporting is exactly what
you're promising the client. If a block genuinely spans two streams, log two entries.

---

## 4. The invoice engine (pure SQL, cron-invoked)

Runs entirely in Postgres so it's transactional and never depends on fire-and-forget HTTP.

```sql
create or replace function generate_monthly_invoices(p_period date default null)
returns setof invoices
language plpgsql
security definer
as $$
declare
  v_start  date := date_trunc('month', coalesce(p_period, current_date) - interval '1 month');
  v_end    date := (date_trunc('month', coalesce(p_period, current_date)) - interval '1 day');
  v_client clients%rowtype;
  v_inv    invoices%rowtype;
  v_num    text;
  v_seq    int;
  v_sum    numeric(12,2);
begin
  for v_client in select * from clients where active loop

    -- skip if there are no uninvoiced billable entries in the period
    if not exists (
      select 1 from time_entries te
      join work_streams ws on ws.id = te.work_stream_id
      where ws.client_id = v_client.id
        and te.invoice_id is null and te.billable
        and te.entry_date between v_start and v_end
    ) then continue; end if;

    -- sequential number, per year, locked
    select coalesce(max(split_part(invoice_number,'-',3)::int),0)+1
      into v_seq from invoices
      where invoice_number like 'CRESTE-'||to_char(v_start,'YYYY')||'-%';
    v_num := 'CRESTE-'||to_char(v_start,'YYYY')||'-'||lpad(v_seq::text,3,'0');

    -- amount branches on engagement type
    select coalesce(sum(te.hours * te.bill_rate),0) into v_sum
      from time_entries te
      join work_streams ws on ws.id = te.work_stream_id
      where ws.client_id = v_client.id
        and te.invoice_id is null and te.billable
        and te.entry_date between v_start and v_end;

    if v_client.engagement = 'retainer'   then v_sum := v_client.retainer_amount;
    elsif v_client.engagement = 'fixed_fee' then v_sum := v_client.fixed_fee_amount;
    elsif v_client.engagement = 'equity'    then v_sum := 0;
    end if;  -- 'hourly' keeps the summed value

    insert into invoices (client_id, invoice_number, period_start, period_end,
      issue_date, due_date, currency, subtotal, total, status)
    values (v_client.id, v_num, v_start, v_end,
      current_date, current_date + (v_client.payment_terms_days || ' days')::interval,
      v_client.currency, v_sum, v_sum, 'issued')
    returning * into v_inv;

    -- stamp the entries so they can't be re-billed
    update time_entries te set invoice_id = v_inv.id
      from work_streams ws
      where ws.id = te.work_stream_id and ws.client_id = v_client.id
        and te.invoice_id is null and te.billable
        and te.entry_date between v_start and v_end;

    return next v_inv;
  end loop;
end $$;
```

Key point: **hourly** bills the summed hours; **retainer / fixed_fee** bill the agreed number
regardless of hours (but you still logged the hours, so margin is visible); **equity** bills
$0. Hours are always tracked — only the billed amount changes.

---

## 5. Scheduling — "first business day of the month"

`pg_cron` has no native "first business day" expression, and cron itself only knows dates.
So: **run daily, guard inside the function.**

```sql
-- daily at 14:00 UTC ≈ 06:00–07:00 America/Los_Angeles
select cron.schedule('monthly-invoices', '0 14 * * *', $$
  select generate_monthly_invoices()
  where extract(day from current_date) <= 3            -- only early in the month
    and extract(dow  from current_date) between 1 and 5 -- Mon–Fri
    and not exists (                                     -- and not already run this month
      select 1 from invoices
      where period_start = date_trunc('month', current_date - interval '1 month')
    );
$$);
```

This fires on the 1st if it's a weekday, else rolls to the 2nd/3rd, and the `not exists`
guard makes it idempotent — it can run every day safely and only generates once. MVP skips
federal holidays; add a `holidays` table later if a Jan 1 / Jul 4 edge case ever bites.

For MVP you can also just leave this **manual** — an admin clicks "Generate invoices for last
month," which calls the same function. Automate once you trust it.

---

## 6. Security — RLS is the model

Roles live on `resources.role`. A helper reads the caller's role:

```sql
create or replace function current_role() returns app_role
language sql stable security definer as $$
  select role from resources where auth_user_id = auth.uid();
$$;
```

Policy shape:

- **Members** can `select / insert / update` their **own** `time_entries`, but only while
  `invoice_id is null`. Once billed, the row is locked. They cannot see `cost_rate`, other
  people's entries, clients, or invoices.
- **Admins** (the two founders) get full access to everything.
- `cost_rate` exposure: keep it out of any view a member can reach. Simplest is a member-facing
  view that omits `cost_rate` entirely.

```sql
alter table time_entries enable row level security;

create policy member_own_entries on time_entries
  for all to authenticated
  using (
    current_role() = 'admin'
    or (resource_id in (select id from resources where auth_user_id = auth.uid())
        and invoice_id is null)
  )
  with check (
    current_role() = 'admin'
    or (resource_id in (select id from resources where auth_user_id = auth.uid())
        and invoice_id is null)
  );
```

Apply analogous admin-only policies to `clients`, `work_streams`, `invoices`, and the
`cost_rate` column of `resources`.

---

## 7. Branded PDF + itemized report

`@react-pdf/renderer`, rendered on demand from a route handler (`/api/invoices/[id]/pdf`).
Brand tokens live in one shared module so the invoice matches the SOW / Proposal templates:

```ts
// lib/brand.ts
export const brand = {
  oxblood:   '#4A0E1C',   // PLACEHOLDER — set to the exact Creste oxblood
  ink:       '#1A1A1A',
  wordmark:  'CRESTE',
  rule:      '#4A0E1C',   // oxblood section dividers
};
```

The itemized report is not a separate document — it's the invoice's body: line items grouped
**by work stream**, and a secondary breakdown **by resource** (name, hours, rate, amount),
under the CRESTE wordmark header with oxblood rule dividers. Header shows invoice number,
period, issue/due dates. UBI and EIN render from env/config once you have them (placeholders
for now, consistent with the SOW/Proposal templates).

---

## 8. Dashboard (post-MVP) — the pace tracker, at team scale

This is where the spreadsheet instinct returns, generalized:

- **Month-to-date** billable per client and total (the "am I on track" number).
- **Utilization** per resource: billable hours ÷ capacity.
- **Margin** per client / work stream: `sum(hours × bill_rate) − sum(hours × cost_rate)`.
- **Retainer / fixed-fee burn-down**: hours logged vs. the flat fee, so you see when an
  engagement is underwater.

---

## 9. Repo layout

```
creste-time/
├── app/
│   ├── (auth)/login/
│   ├── time/                # daily logging surface — the high-frequency screen
│   ├── clients/             # admin: clients + work streams
│   ├── invoices/            # admin: list, generate, view, download PDF
│   ├── dashboard/           # post-MVP
│   └── api/invoices/[id]/pdf/
├── components/
├── lib/
│   ├── supabase/            # server + browser clients
│   ├── brand.ts
│   └── pdf/                 # react-pdf invoice document
├── supabase/
│   ├── migrations/          # every schema change, in order
│   └── seed.sql             # the two founders, one demo client
├── docs/
│   ├── ARCHITECTURE.md      # this file
│   └── PROMPT_PLAN.md
├── open-next.config.ts
└── wrangler.toml
```

---

## 10. Secrets

Never in `wrangler.toml`. Use `wrangler secret put` (Workers) and Supabase Vault (any secret
a DB function needs). Local Workers dev reads `.dev.vars`, not `.env.local` — keep a
`.dev.vars.example` in the repo and gitignore the real one.

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client
- `SUPABASE_SERVICE_ROLE_KEY` — server only, never shipped to the browser

---

## 11. MVP cut line

**Ship:** the four tables + invoices, RLS, the time-logging screen, admin CRUD for
clients/work streams, **manual** invoice generation, the branded PDF with itemized breakdown.

**Defer:** cron automation (run manually first), the analytics dashboard, holiday-aware
scheduling, multi-currency, retainer burn-down alerts, GitHub activity ingestion (§12),
daily/weekly summary email (§13).

The schema is the durable asset. Get the model right, start logging real hours this week,
generate the first real invoice once a month of data exists.

---

## 12. GitHub activity ingestion (Phase 9)

Commits are a rich, free activity log — but **commits are not hours.** Git tells you *what* and
roughly *when*, never *how long*: two commits four hours apart might be thirty focused minutes,
and a squashed PR merge is one timestamp for a week. So git **drafts** entries; the human
**confirms** hours before anything becomes billable. This keeps the whole point of the model
intact — an invoice you can defend to a client.

Three mapping problems and their resolutions:

- **Repo → client.** A `repo_mappings` table (repo full name → client + default work stream).
- **Commit → work stream.** Use the conventional-commit *scope* as the work-stream slug:
  `feat(dashboard-ui): ...` → the "Dashboard UI" stream. The developer's normal commit hygiene
  becomes the time-tracking metadata, zero extra tooling. No scope → falls back to the repo's
  default stream, human picks on confirm.
- **Claude Code sessions self-tag.** Put the scope convention in the repo's `CLAUDE.md`, so a
  session's commits carry their own work-stream tags. That's the "pull what I did this session
  straight from the commits" loop, closed.

Data lands in a **staging table**, decoupled from `time_entries` so the billing table stays
human-clean:

```sql
create table repo_mappings (
  id                  uuid primary key default gen_random_uuid(),
  repo_full_name      text not null unique,        -- "creste/creste-time"
  client_id           uuid not null references clients(id),
  default_work_stream uuid references work_streams(id)
);

-- add a slug so commit scopes can resolve to a stream
alter table work_streams add column slug text;      -- "dashboard-ui"

create table commit_activity (
  id             uuid primary key default gen_random_uuid(),
  sha            text not null unique,
  repo_full_name text not null,
  author_email   text,
  message        text,
  committed_at   timestamptz not null,
  client_id      uuid references clients(id),        -- resolved from repo_mappings
  work_stream_id uuid references work_streams(id),   -- resolved from commit scope
  entry_id       uuid references time_entries(id),   -- null until converted
  created_at     timestamptz not null default now()
);
```

**Ingestion:** a GitHub webhook (push events) → a Supabase Edge Function that **verifies the
HMAC signature** and inserts into `commit_activity`, resolving `repo_mappings` and the commit
scope. Signature verification is not optional — this data feeds draft billing; an unverified
endpoint lets anyone inject fake activity. A daily poll of the GitHub API is the simpler
fallback if you'd rather not run webhooks yet.

**Conversion:** `/time` gets a "Suggested from commits" panel — the day's staged commits,
grouped by resolved work stream, with a proposed description (the commit messages, optionally
polished into one line via an Anthropic API call). The person sets **hours** and approves; that
creates confirmed `time_entries` (snapshotting rates) and stamps `commit_activity.entry_id`.
Commit content is only ever **data** — displayed and confirmed, never auto-billed, never allowed
to trigger a side effect.

**Auth:** fine-grained read-only PAT (contents + metadata) for MVP, a GitHub App if it grows.
Store in Supabase Vault, never in the browser.

---

## 13. Daily / weekly summary email (Phase 10)

The day's confirmed entries, grouped `client → work stream → resource` with descriptions and
total hours — which is exactly the invoice's itemized section scoped to one day. **Reuse that
grouping logic**; don't rebuild it.

**Audience is a fork, and it changes the defaults:**

- **Internal** (you + team, end-of-day log): low stakes, can eventually auto-send. Good default
  for the *daily* cadence.
- **Client-facing** ("here's what shipped on your project"): high-touch and on brand — but a
  daily client email is usually too much noise. Better as a **weekly** digest, and **always
  human-approved**. For a luxury studio the weekly update is a differentiator, not overhead.

**Generation and sending are split, deliberately** — same principle as the invoice engine. An
end-of-day cron *drafts* the summary (optionally running commit messages + entries through the
Anthropic API for polished prose — a natural place to dogfood your own AI service). The **send
is human-gated**: draft → review → one-click send. Nothing client-facing goes out unreviewed.

```sql
create table daily_summaries (
  id           uuid primary key default gen_random_uuid(),
  summary_date date not null,
  audience     text not null default 'internal',   -- 'internal' | 'client'
  client_id    uuid references clients(id),          -- set for client-facing
  content      text,                                 -- rendered draft
  status       text not null default 'draft',        -- 'draft' | 'sent'
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
```

**Sending:** Resend (HTTP API, runs fine on Workers). Key in Vault. A missed daily email is
low-stakes, so the fire-and-forget cron caveat from §5 doesn't bite here the way it does for
invoices.

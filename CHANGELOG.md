# Changelog

All notable changes to clockit are documented here (newest date on top).

## 2026-07-07

### Added
- **Purchase orders + signed agreements**: `purchase_orders` + `po_documents` tables and `time_entries.po_id` (migration). A PO belongs to a client, carries an authorized `amount` (burn-down), and can hold multiple signed-agreement files in a **private `agreements` Supabase Storage bucket**.
  - `/clients` — per-client **PO panel**: list POs (number · status · burn-down vs amount · dates), **Add PO**, and **upload / open** signed agreements (service-role upload + short-lived signed URLs).
  - `/time` — **PO dropdown** scoped to the selected client's active POs; **required when that client has an active PO**; the PO shows on each entry.
  - Invoice detail + print show the referenced **PO number(s)**.

## 2026-07-03

### Added
- Imported Sean's historical hours from the **TimeSheet** Google Sheet: client **Glocod** (ILS, hourly), 5 keyword-inferred work streams (Ingestion Engine, Meetings, Frontend, Data Sources, DevOps & Deploy), 9 monthly invoices (`CRESTE-2025-001/002`, `CRESTE-2026-001…007`, `issued`), and **253 `time_entries`** (951h, ₪142,650) with `bill_rate = cost_rate = ₪150` snapshotted and each stamped to its month's invoice. Idempotent SQL + provenance under `supabase/imports/`.
- `/time` entry surface: fast logging form (no `<form>` — `onChange`/`onClick`; date/work-stream/hours/description/billable), **server-side rate snapshot** (`bill_rate`/`cost_rate` from the resource's defaults), and a current-week view grouped by day with weekly total; invoiced entries render read-only. The work-stream dropdown is server-curated (service role) to clients the resource has worked with.

- **Creste editorial design system** (from the Claude Design "Creste Screens"): Instrument Serif / Archivo / IBM Plex Mono type, warm-paper palette tokens (`paper`/`card`/`oxblood`/`ink`/status accents), a shared `AppShell` (wordmark top-bar, section nav, user avatar, sign-out) and UI primitives (`Btn`, `StatusBadge`, `CardHeader`, `Label`). Design reference committed under `docs/design/`.
- **`/entries`** — studio-wide (admin) / own (member) time-entries table with month nav + uninvoiced filter, admin Amount column, and period total.
- **`/clients`** — admin clients & work-streams management: editorial list with budget bars, engagement badges, and inline create-client / create-work-stream forms (admin-guarded server actions). Added `work_streams.slug` (backfilled from names, ARCHITECTURE.md §12).
- **`/invoices`** — admin invoices list with a month-to-date strip (billable / uninvoiced hours / outstanding), a **Generate** button wired to the new `generate_monthly_invoices()` SQL engine (ARCHITECTURE.md §4, service-role only), and status badges; rows link to detail.
- **`/invoices/[id]`** — itemized invoice detail grouped by work stream → resource (hours · rate · amount), admin margin, and Print/PDF / Email / Mark paid actions.
- **`/invoices/[id]/print`** — branded, print-optimized invoice sheet (masthead with UBI/EIN placeholders per §7, meta grid, work-stream→resource line items, subtotal/total, remit footer); "Save as PDF / Print" via the browser. Chosen over `@react-pdf/renderer` because its `@noble/curves` dependency breaks the OpenNext/Workers build — the print-HTML route is Workers-compatible and renders with real fonts + the ₪ symbol.

### Changed
- Set Sean's resource `default_bill_rate` to ₪150 (matches the Glocod rate) so new `/time` entries snapshot correctly.
- Restyled **home** and **/login** to the editorial system; **/time** is now a **daily** editorial view (day nav, grid entries, admin Amount column, billed/locked rows with 🔒, inline add row).

### Removed
- Phase-3 RLS test artifacts (`CRESTE-2026-TEST` invoice + member test entries).

## 2026-07-02

### Added
- Scaffold Next.js (App Router, TypeScript, Tailwind v4) targeting **Cloudflare Workers** via `@opennextjs/cloudflare`, with `wrangler.toml` (`nodejs_compat`, compatibility date `2025-05-05`), `open-next.config.ts`, `initOpenNextCloudflareForDev()`, and `preview`/`deploy`/`cf-typegen` scripts.
- Supabase server + browser clients under `lib/supabase/` (`@supabase/ssr`), reading env at call time.
- `lib/brand.ts` brand tokens (ARCHITECTURE.md §7).
- `.dev.vars.example` documenting Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Branded "hello" landing page; deployed to Cloudflare Workers at https://clockit.sean-dahan.workers.dev.
- Initial database schema migration (`supabase/migrations/`): enums (`app_role`, `engagement_type`, `invoice_status`) + tables `resources`, `clients`, `work_streams`, `invoices`, `time_entries` (invoices before time_entries for the FK); added `resources.email` for auth↔resource linking; `hours` check (`0 < hours ≤ 24`); indexes on `time_entries(work_stream_id, invoice_id, entry_date)` and `work_streams(client_id)`.
- Idempotent `supabase/seed.sql`: two founding-partner admins, demo client Acme Studio with two work streams. Created the Supabase `clockit` project (Creste org, `us-west-1`) and applied the migration + seed.
- Supabase email auth: `/login` route (sign in/up/out server actions, no `<form>`), route-protecting middleware (session refresh via `@supabase/ssr`), and a server-side service-role admin client.
- Link `auth.users` → `resources` by email on first sign-in (idempotent, service-role).
- RLS (`supabase/migrations/…_rls_policies.sql`): schema-qualified `public.current_role()` helper + policies — members read/write only their own *uninvoiced* `time_entries` and cannot see `clients`/`work_streams`/`invoices`; admins full access; `cost_rate` hidden from client roles via column privileges (service-role only).

### Changed
- Restored the project `README.md` (create-next-app had overwritten it) and documented dev/preview/deploy.
- Home page shows the signed-in resource + role with sign-out; seed adds one `member` resource (`dev@creste.dev`) so member-scoped RLS can be exercised.

### Removed
- Unused create-next-app placeholder SVGs from `public/`.

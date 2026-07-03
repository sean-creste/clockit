# Changelog

All notable changes to clockit are documented here (newest date on top).

## 2026-07-02

### Added
- Scaffold Next.js (App Router, TypeScript, Tailwind v4) targeting **Cloudflare Workers** via `@opennextjs/cloudflare`, with `wrangler.toml` (`nodejs_compat`, compatibility date `2025-05-05`), `open-next.config.ts`, `initOpenNextCloudflareForDev()`, and `preview`/`deploy`/`cf-typegen` scripts.
- Supabase server + browser clients under `lib/supabase/` (`@supabase/ssr`), reading env at call time.
- `lib/brand.ts` brand tokens (ARCHITECTURE.md §7).
- `.dev.vars.example` documenting Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Branded "hello" landing page; deployed to Cloudflare Workers at https://clockit.sean-dahan.workers.dev.
- Initial database schema migration (`supabase/migrations/`): enums (`app_role`, `engagement_type`, `invoice_status`) + tables `resources`, `clients`, `work_streams`, `invoices`, `time_entries` (invoices before time_entries for the FK); added `resources.email` for auth↔resource linking; `hours` check (`0 < hours ≤ 24`); indexes on `time_entries(work_stream_id, invoice_id, entry_date)` and `work_streams(client_id)`.
- Idempotent `supabase/seed.sql`: two founding-partner admins, demo client Acme Studio with two work streams. Created the Supabase `clockit` project (Creste org, `us-west-1`) and applied the migration + seed.

### Changed
- Restored the project `README.md` (create-next-app had overwritten it) and documented dev/preview/deploy.

### Removed
- Unused create-next-app placeholder SVGs from `public/`.

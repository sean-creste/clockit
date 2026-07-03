# Changelog

All notable changes to clockit are documented here (newest date on top).

## 2026-07-02

### Added
- Scaffold Next.js (App Router, TypeScript, Tailwind v4) targeting **Cloudflare Workers** via `@opennextjs/cloudflare`, with `wrangler.toml` (`nodejs_compat`, compatibility date `2025-05-05`), `open-next.config.ts`, `initOpenNextCloudflareForDev()`, and `preview`/`deploy`/`cf-typegen` scripts.
- Supabase server + browser clients under `lib/supabase/` (`@supabase/ssr`), reading env at call time.
- `lib/brand.ts` brand tokens (ARCHITECTURE.md §7).
- `.dev.vars.example` documenting Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- Branded "hello" landing page; deployed to Cloudflare Workers at https://clockit.sean-dahan.workers.dev.

### Changed
- Restored the project `README.md` (create-next-app had overwritten it) and documented dev/preview/deploy.

### Removed
- Unused create-next-app placeholder SVGs from `public/`.

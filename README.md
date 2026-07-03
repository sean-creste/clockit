# clockit

A time-tracking and invoicing system for a small, growing studio. Resources log hours against client work streams. On the first business day of each month, the system generates one invoice per client for the prior month, plus an itemized report broken down by work stream and by resource.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind
- **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
- **Supabase** (Postgres + RLS + Auth)

## Development

```bash
npm run dev        # Next.js dev server (localhost:3000)
npm run preview    # build + serve in the local Workers runtime (workerd)
npm run deploy     # build + deploy to Cloudflare Workers
```

Local dev vars go in `.dev.vars` (copy from [`.dev.vars.example`](./.dev.vars.example)); never commit real secrets. Production secrets are set via `wrangler secret put` / the Cloudflare dashboard. See `ARCHITECTURE.md` §10.

Deployed at: https://clockit.sean-dahan.workers.dev

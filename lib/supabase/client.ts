import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client (uses the public anon key + RLS).
// Env is read at call time so a missing value never breaks the build.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

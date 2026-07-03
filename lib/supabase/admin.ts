import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Uses the service-role key and bypasses RLS — never import this
// into client components. Use for privileged operations: linking auth users to
// resources, snapshotting cost_rate, admin/margin reads.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

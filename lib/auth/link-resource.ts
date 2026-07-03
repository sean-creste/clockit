import { createAdminClient } from "@/lib/supabase/admin";

// On first sign-in, attach the authenticated user to a pre-provisioned resource
// row matched by (normalized) email. Idempotent: only fills auth_user_id when it
// is currently null, so it never re-points an already-linked resource.
// Runs with the service-role key (bypasses RLS) and only after a real,
// email-verified session exists (safer than an auth.users trigger).
export async function linkResourceByEmail(userId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("resources")
    .update({ auth_user_id: userId })
    .eq("email", normalized)
    .is("auth_user_id", null);

  if (error) {
    // Non-fatal: an unlinked user simply has no role and sees nothing (RLS).
    console.error("linkResourceByEmail failed:", error.message);
  }
}

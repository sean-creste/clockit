"use server";

import { revalidatePath } from "next/cache";
import { createClient as sbServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await sbServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { admin: null, error: "Not signed in." as string | null };
  const admin = createAdminClient();
  const { data: resource } = await admin
    .from("resources")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (resource?.role !== "admin") return { admin: null, error: "Admin only." };
  return { admin, error: null };
}

// Runs the §4 engine (service role). `period` = a date in the month AFTER the
// target month (the function invoices the prior month). Returns how many
// invoices were created (0 when everything billable is already invoiced).
export async function generateInvoices(period?: string): Promise<{ error?: string; count?: number }> {
  const { admin, error } = await requireAdmin();
  if (!admin) return { error: error ?? "Admin only." };
  const { data, error: e } = await admin.rpc(
    "generate_monthly_invoices",
    period ? { p_period: period } : {},
  );
  if (e) return { error: e.message };
  revalidatePath("/invoices");
  return { count: Array.isArray(data) ? data.length : 0 };
}

export async function markInvoicePaid(id: string): Promise<{ error?: string }> {
  const { admin, error } = await requireAdmin();
  if (!admin) return { error: error ?? "Admin only." };
  const { error: e } = await admin.from("invoices").update({ status: "paid" }).eq("id", id);
  if (e) return { error: e.message };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  return {};
}

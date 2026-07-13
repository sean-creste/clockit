"use server";

import { revalidatePath } from "next/cache";
import { createClient as sbServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await sbServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { admin: null as ReturnType<typeof createAdminClient> | null, error: "Not signed in." };
  const admin = createAdminClient();
  const { data: resource } = await admin
    .from("resources")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (resource?.role !== "admin") return { admin: null, error: "Admin only." };
  return { admin, error: null as string | null };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== "" ? n : null;
}

export async function createClientRecord(input: {
  name: string;
  currency: string;
  engagement: string;
  paymentTermsDays: number;
  billingEmail: string;
}): Promise<{ error?: string }> {
  const { admin, error } = await requireAdmin();
  if (!admin) return { error: error! };
  if (!input.name.trim()) return { error: "Name is required." };

  const { error: e } = await admin.from("clients").insert({
    name: input.name.trim(),
    currency: input.currency || "USD",
    engagement: input.engagement || "hourly",
    payment_terms_days: input.paymentTermsDays || 30,
    billing_email: input.billingEmail.trim() || null,
  });
  if (e) return { error: e.message };
  revalidatePath("/clients");
  return {};
}

export async function createWorkStream(input: {
  clientId: string;
  name: string;
  slug: string;
  budgetHours: string;
  budgetAmount: string;
}): Promise<{ error?: string }> {
  const { admin, error } = await requireAdmin();
  if (!admin) return { error: error! };
  if (!input.clientId) return { error: "Missing client." };
  if (!input.name.trim()) return { error: "Name is required." };

  const { error: e } = await admin.from("work_streams").insert({
    client_id: input.clientId,
    name: input.name.trim(),
    slug: input.slug.trim() || null,
    budget_hours: num(input.budgetHours),
    budget_amount: num(input.budgetAmount),
  });
  if (e) return { error: e.message };
  revalidatePath("/clients");
  return {};
}

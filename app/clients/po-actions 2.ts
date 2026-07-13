"use server";

import { revalidatePath } from "next/cache";
import { createClient as sbServer } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await sbServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { admin: null, userId: null, error: "Not signed in." as string | null };
  const admin = createAdminClient();
  const { data: resource } = await admin
    .from("resources")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (resource?.role !== "admin") return { admin: null, userId: null, error: "Admin only." };
  return { admin, userId: user.id, error: null };
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && String(v).trim() !== "" ? n : null;
}

export async function createPurchaseOrder(input: {
  clientId: string;
  poNumber: string;
  description: string;
  amount: string;
  currency: string;
  issueDate: string;
  expiryDate: string;
}): Promise<{ error?: string }> {
  const { admin, error } = await requireAdmin();
  if (!admin) return { error: error ?? "Admin only." };
  if (!input.clientId) return { error: "Missing client." };
  if (!input.poNumber.trim()) return { error: "PO number is required." };

  const { error: e } = await admin.from("purchase_orders").insert({
    client_id: input.clientId,
    po_number: input.poNumber.trim(),
    description: input.description.trim() || null,
    amount: num(input.amount),
    currency: input.currency || "USD",
    issue_date: input.issueDate || null,
    expiry_date: input.expiryDate || null,
  });
  if (e) return { error: e.message };
  revalidatePath("/clients");
  return {};
}

// Upload a signed agreement (or amendment) to the private 'agreements' bucket
// and record it in po_documents. Runs server-side with the service role.
export async function uploadAgreement(formData: FormData): Promise<{ error?: string }> {
  const { admin, userId, error } = await requireAdmin();
  if (!admin) return { error: error ?? "Admin only." };

  const poId = String(formData.get("poId") ?? "");
  const file = formData.get("file");
  if (!poId) return { error: "Missing PO." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > 25 * 1024 * 1024) return { error: "File too large (max 25 MB)." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${poId}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await admin.storage
    .from("agreements")
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) return { error: upErr.message };

  const { error: e } = await admin.from("po_documents").insert({
    po_id: poId,
    name: file.name,
    path,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: userId,
  });
  if (e) return { error: e.message };

  revalidatePath("/clients");
  return {};
}

// Short-lived signed URL so an admin can open a private agreement.
export async function agreementUrl(path: string): Promise<{ url?: string; error?: string }> {
  const { admin, error } = await requireAdmin();
  if (!admin) return { error: error ?? "Admin only." };
  const { data, error: e } = await admin.storage.from("agreements").createSignedUrl(path, 300);
  if (e) return { error: e.message };
  return { url: data.signedUrl };
}

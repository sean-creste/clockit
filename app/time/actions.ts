"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AddEntryInput = {
  entryDate: string;
  workStreamId: string;
  hours: number;
  description: string;
  billable: boolean;
};

// Insert a time entry, snapshotting bill_rate + cost_rate from the caller's
// resource defaults (ARCHITECTURE.md §3 invariant 1). Done server-side with the
// service role so rates are written correctly and cost_rate never touches the client.
export async function addEntry(input: AddEntryInput): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const admin = createAdminClient();

  const { data: resource } = await admin
    .from("resources")
    .select("id, default_bill_rate, cost_rate")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!resource) return { error: "No resource is linked to your account." };
  if (resource.default_bill_rate == null)
    return { error: "Your resource has no default bill rate set." };

  const hours = Number(input.hours);
  if (!(hours > 0 && hours <= 24))
    return { error: "Hours must be greater than 0 and at most 24." };
  if (!input.entryDate) return { error: "Date is required." };
  if (!input.workStreamId) return { error: "Pick a work stream." };

  // Validate the stream is active and belongs to an active client.
  const { data: stream } = await admin
    .from("work_streams")
    .select("id, active, clients(active)")
    .eq("id", input.workStreamId)
    .maybeSingle();
  const clientActive = (stream?.clients as { active?: boolean } | null)?.active;
  if (!stream || !stream.active || !clientActive)
    return { error: "That work stream is not available." };

  const { error } = await admin.from("time_entries").insert({
    resource_id: resource.id,
    work_stream_id: input.workStreamId,
    entry_date: input.entryDate,
    hours,
    description: input.description?.trim() || null,
    bill_rate: resource.default_bill_rate, // SNAPSHOT
    cost_rate: resource.cost_rate, // SNAPSHOT
    billable: input.billable,
    invoice_id: null,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/time");
  return {};
}

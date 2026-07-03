import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { TimeClient } from "./time-client";

// Monday..Sunday week containing `d` (as YYYY-MM-DD strings).
function weekBounds(d: Date) {
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6));
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export default async function TimePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: resource } = await admin
    .from("resources")
    .select("id, name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!resource) {
    return (
      <main className="min-h-screen p-8" style={{ backgroundColor: brand.ink }}>
        <p className="text-amber-400">No resource is linked to your account yet.</p>
        <Link href="/" className="text-zinc-300 underline">Home</Link>
      </main>
    );
  }

  // Dropdown: active streams on active clients this resource has worked with.
  const { data: used } = await admin
    .from("time_entries")
    .select("work_streams(client_id)")
    .eq("resource_id", resource.id);
  const workedClientIds = new Set(
    (used ?? [])
      .map((r) => (r.work_streams as { client_id?: string } | null)?.client_id)
      .filter(Boolean) as string[],
  );
  const { data: allStreams } = await admin
    .from("work_streams")
    .select("id, name, client_id, active, clients(name, active)")
    .eq("active", true);
  const streams = (allStreams ?? [])
    .filter((s) => {
      const c = s.clients as { name?: string; active?: boolean } | null;
      return c?.active && workedClientIds.has(s.client_id as string);
    })
    .map((s) => ({
      id: s.id as string,
      name: s.name as string,
      clientName: (s.clients as { name?: string } | null)?.name ?? "",
    }))
    .sort((a, b) => (a.clientName + a.name).localeCompare(b.clientName + b.name));

  // This week's entries for this resource.
  const { start, end } = weekBounds(new Date());
  const { data: rows } = await admin
    .from("time_entries")
    .select("id, entry_date, hours, description, billable, invoice_id, work_streams(name, clients(name))")
    .eq("resource_id", resource.id)
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: true });

  const entries = (rows ?? []).map((r) => {
    const ws = r.work_streams as { name?: string; clients?: { name?: string } } | null;
    return {
      id: r.id as string,
      entryDate: r.entry_date as string,
      hours: Number(r.hours),
      description: (r.description as string) ?? "",
      billable: Boolean(r.billable),
      invoiced: r.invoice_id != null,
      streamName: ws?.name ?? "",
      clientName: ws?.clients?.name ?? "",
    };
  });

  return (
    <TimeClient
      resourceName={resource.name as string}
      streams={streams}
      entries={entries}
      weekStart={start}
      weekEnd={end}
    />
  );
}

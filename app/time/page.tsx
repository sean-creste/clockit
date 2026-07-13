import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { brand } from "@/lib/brand";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayISO, addDaysISO, dayParts } from "@/lib/format";
import { TimeDay } from "./time-client";

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
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
      <main className="flex min-h-screen items-center justify-center p-8 text-center">
        <div>
          <p className="mb-3" style={{ color: brand.open }}>
            No resource is linked to your account yet.
          </p>
          <Link href="/" className="text-sm underline" style={{ color: "rgba(26,26,26,.5)" }}>
            Home
          </Link>
        </div>
      </main>
    );
  }

  const role = resource.role as "admin" | "member";
  const day =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();

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
      const c = s.clients as { active?: boolean } | null;
      return c?.active && workedClientIds.has(s.client_id as string);
    })
    .map((s) => ({
      id: s.id as string,
      name: s.name as string,
      clientId: s.client_id as string,
      clientName: (s.clients as { name?: string } | null)?.name ?? "",
    }))
    .sort((a, b) => (a.clientName + a.name).localeCompare(b.clientName + b.name));

  // Active POs per worked-with client (for the entry PO dropdown).
  const workedArr = [...workedClientIds];
  const poByClient: Record<string, { id: string; poNumber: string }[]> = {};
  if (workedArr.length) {
    const { data: poRows } = await admin
      .from("purchase_orders")
      .select("id, po_number, client_id")
      .eq("status", "active")
      .in("client_id", workedArr);
    for (const p of poRows ?? []) {
      (poByClient[p.client_id as string] ??= []).push({
        id: p.id as string,
        poNumber: p.po_number as string,
      });
    }
  }

  // Entries for the selected day.
  const { data: rows } = await admin
    .from("time_entries")
    .select("id, hours, description, billable, invoice_id, bill_rate, work_streams(name, clients(name, currency)), purchase_orders(po_number)")
    .eq("resource_id", resource.id)
    .eq("entry_date", day)
    .order("created_at", { ascending: true });

  const entries = (rows ?? []).map((r) => {
    const ws = r.work_streams as
      | { name?: string; clients?: { name?: string; currency?: string } }
      | null;
    return {
      id: r.id as string,
      hours: Number(r.hours),
      description: (r.description as string) ?? "",
      billable: Boolean(r.billable),
      invoiced: r.invoice_id != null,
      streamName: ws?.name ?? "",
      clientName: ws?.clients?.name ?? "",
      currency: ws?.clients?.currency ?? "USD",
      billRate: Number(r.bill_rate),
      poNumber: (r.purchase_orders as { po_number?: string } | null)?.po_number ?? null,
    };
  });

  const dayTotal = entries.reduce((s, e) => s + e.hours, 0);
  const { weekday, date } = dayParts(day);

  return (
    <AppShell active="time" section="time" userName={resource.name} role={role}>
      <TimeDay
        day={day}
        weekday={weekday}
        dateLabel={date}
        prevDate={addDaysISO(day, -1)}
        nextDate={addDaysISO(day, 1)}
        today={todayISO()}
        dayTotal={dayTotal}
        entries={entries}
        streams={streams}
        poByClient={poByClient}
        isAdmin={role === "admin"}
      />
    </AppShell>
  );
}

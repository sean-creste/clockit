import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Btn, CardHeader, StatusBadge } from "@/components/ui";
import { brand } from "@/lib/brand";
import { hoursLabel, money } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function monthBounds(ym: string) {
  const y = +ym.slice(0, 4);
  const m = +ym.slice(5, 7);
  const start = `${ym}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}
function shiftMonth(ym: string, d: number) {
  const y = +ym.slice(0, 4);
  const m = +ym.slice(5, 7) - 1 + d;
  const nd = new Date(Date.UTC(y, m, 1));
  return `${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(ym: string) {
  return new Date(ym + "-01T00:00:00Z").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
function shortDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; uninvoiced?: string }>;
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
  if (!resource) redirect("/");
  const isAdmin = resource.role === "admin";

  // default month = latest month with entries (scoped to visibility)
  const latestQ = admin
    .from("time_entries")
    .select("entry_date")
    .order("entry_date", { ascending: false })
    .limit(1);
  if (!isAdmin) latestQ.eq("resource_id", resource.id);
  const { data: latest } = await latestQ;
  const defaultMonth = latest?.[0]?.entry_date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : defaultMonth;
  const uninvoiced = sp.uninvoiced === "1";
  const { start, end } = monthBounds(month);

  let q = admin
    .from("time_entries")
    .select(
      "id, entry_date, hours, description, billable, invoice_id, bill_rate, resources(name), work_streams(name, clients(name, currency))",
    )
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: false });
  if (!isAdmin) q = q.eq("resource_id", resource.id);
  if (uninvoiced) q = q.is("invoice_id", null);
  const { data: rows } = await q;

  const entries = (rows ?? []).map((r) => {
    const ws = r.work_streams as
      | { name?: string; clients?: { name?: string; currency?: string } }
      | null;
    return {
      id: r.id as string,
      date: r.entry_date as string,
      resourceName: (r.resources as { name?: string } | null)?.name ?? "",
      client: ws?.clients?.name ?? "",
      stream: ws?.name ?? "",
      currency: ws?.clients?.currency ?? "USD",
      description: (r.description as string) ?? "",
      hours: Number(r.hours),
      amount: Number(r.hours) * Number(r.bill_rate),
      invoiced: r.invoice_id != null,
    };
  });
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalAmount = entries.reduce((s, e) => s + e.amount, 0);
  const currency = entries[0]?.currency ?? "USD";

  const grid = isAdmin
    ? "84px 120px 140px 120px 1fr 56px 96px 74px"
    : "84px 140px 120px 1fr 56px 74px";

  const pill = (active: boolean): React.CSSProperties => ({
    fontSize: 11,
    borderRadius: 999,
    padding: "6px 13px",
    color: active ? brand.light : "rgba(26,26,26,.6)",
    background: active ? brand.oxblood : "transparent",
    border: active ? "none" : "1px solid rgba(26,26,26,.18)",
  });

  return (
    <AppShell active="entries" section="entries" userName={resource.name} role={resource.role}>
      <CardHeader
        title="Time entries"
        subtitle={isAdmin ? "All resources · studio-wide" : "Your entries"}
        right={<Btn href="/time">+ Log time</Btn>}
      />

      {/* filter bar */}
      <div
        className="flex flex-wrap items-center gap-2 px-9 py-4"
        style={{ borderBottom: "1px solid rgba(26,26,26,.08)" }}
      >
        <Link href={`/entries?month=${shiftMonth(month, -1)}${uninvoiced ? "&uninvoiced=1" : ""}`} style={pill(false)}>
          ‹
        </Link>
        <span style={pill(true)}>{monthLabel(month)}</span>
        <Link href={`/entries?month=${shiftMonth(month, 1)}${uninvoiced ? "&uninvoiced=1" : ""}`} style={pill(false)}>
          ›
        </Link>
        <Link href={`/entries?month=${month}${uninvoiced ? "" : "&uninvoiced=1"}`} style={pill(uninvoiced)}>
          Uninvoiced only
        </Link>
        <span className="ml-auto text-xs" style={{ color: "rgba(26,26,26,.5)" }}>
          {entries.length} entries
        </span>
      </div>

      {/* header */}
      <div
        className="grid px-9 pb-2 pt-3 uppercase"
        style={{ gridTemplateColumns: grid, columnGap: 14, fontSize: 9, letterSpacing: ".1em", color: "rgba(26,26,26,.4)" }}
      >
        <div>Date</div>
        {isAdmin && <div>Resource</div>}
        <div>Client</div>
        <div>Stream</div>
        <div>Description</div>
        <div className="text-right">Hrs</div>
        {isAdmin && <div className="text-right">Amount</div>}
        <div className="text-right">Status</div>
      </div>

      {/* rows */}
      <div>
        {entries.length === 0 && (
          <div className="px-9 py-8 text-sm" style={{ color: "rgba(26,26,26,.4)" }}>
            No entries in {monthLabel(month)}.
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="grid items-center px-9"
            style={{ gridTemplateColumns: grid, columnGap: 14, padding: "13px 36px", borderTop: "1px solid rgba(26,26,26,.07)" }}
          >
            <div style={{ fontFamily: "var(--font-plex)", fontSize: 11.5, color: "rgba(26,26,26,.6)" }}>
              {shortDate(e.date)}
            </div>
            {isAdmin && <div style={{ fontSize: 12 }}>{e.resourceName}</div>}
            <div style={{ fontSize: 12 }}>{e.client}</div>
            <div style={{ fontSize: 11.5, color: brand.oxblood }}>{e.stream}</div>
            <div
              style={{ fontSize: 11.5, color: "rgba(26,26,26,.65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {e.description}
            </div>
            <div className="text-right" style={{ fontFamily: "var(--font-plex)", fontSize: 12 }}>
              {hoursLabel(e.hours)}
            </div>
            {isAdmin && (
              <div className="text-right" style={{ fontFamily: "var(--font-plex)", fontSize: 11.5, color: "rgba(26,26,26,.6)" }}>
                {money(e.amount, e.currency)}
              </div>
            )}
            <div className="text-right">
              <StatusBadge status={e.invoiced ? "billed" : "open"} />
            </div>
          </div>
        ))}
      </div>

      {/* total */}
      {entries.length > 0 && (
        <div
          className="flex items-center justify-end gap-10 px-9 py-4"
          style={{ borderTop: "2px solid " + brand.oxblood }}
        >
          <div className="uppercase" style={{ fontSize: 11, letterSpacing: ".1em", color: "rgba(26,26,26,.5)" }}>
            Total · {monthLabel(month)}
          </div>
          <div style={{ fontFamily: "var(--font-plex)", fontSize: 13 }}>{hoursLabel(totalHours)}h</div>
          {isAdmin && (
            <div className="font-display" style={{ fontSize: 20, color: brand.oxblood }}>
              {money(totalAmount, currency)}
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

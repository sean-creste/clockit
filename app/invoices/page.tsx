import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CardHeader, StatusBadge } from "@/components/ui";
import { brand } from "@/lib/brand";
import { money } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GenerateButton } from "./generate-button";

function periodLabel(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: resource } = await admin
    .from("resources")
    .select("name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!resource) redirect("/");
  if (resource.role !== "admin") redirect("/time");

  const now = new Date();
  const year = now.getUTCFullYear();
  const monthStart = `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const [{ data: invoices }, { data: monthEntries }, { data: uninv }] = await Promise.all([
    admin
      .from("invoices")
      .select("id, invoice_number, period_start, total, currency, status, clients(name, engagement)")
      .order("period_start", { ascending: false }),
    admin.from("time_entries").select("hours, bill_rate, billable").gte("entry_date", monthStart),
    admin.from("time_entries").select("hours, billable, invoice_id").is("invoice_id", null),
  ]);

  const rows = (invoices ?? []).map((i) => ({
    id: i.id as string,
    number: i.invoice_number as string,
    client: (i.clients as { name?: string } | null)?.name ?? "",
    engagement: (i.clients as { engagement?: string } | null)?.engagement ?? "hourly",
    period: periodLabel(i.period_start as string),
    total: Number(i.total),
    currency: (i.currency as string) ?? "USD",
    status: i.status as string,
  }));

  const currency = rows[0]?.currency ?? "ILS";
  const mtdBillable = (monthEntries ?? [])
    .filter((e) => e.billable)
    .reduce((s, e) => s + Number(e.hours) * Number(e.bill_rate), 0);
  const uninvoicedHours = (uninv ?? [])
    .filter((e) => e.billable)
    .reduce((s, e) => s + Number(e.hours), 0);
  const outstanding = rows
    .filter((r) => r.status === "issued")
    .reduce((s, r) => s + r.total, 0);
  const issuedThisYear = rows.filter(
    (r) => r.status !== "void" && r.number.includes(`-${year}-`),
  );
  const billedThisYear = issuedThisYear.reduce((s, r) => s + r.total, 0);

  // "Generate" targets the prior month (§4 default).
  const prior = new Date(Date.UTC(year, now.getUTCMonth() - 1, 1));
  const priorLabel = prior.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  const grid = "150px 1fr 120px 120px 90px";

  return (
    <AppShell active="invoices" section="invoices" userName={resource.name} role="admin">
      <CardHeader
        title="Invoices"
        subtitle={`${issuedThisYear.length} issued in ${year} · ${money(billedThisYear, currency)} billed`}
        size={30}
        right={<GenerateButton label={priorLabel} />}
      />

      {/* MTD strip */}
      <div className="grid grid-cols-3" style={{ borderBottom: "1px solid rgba(74,14,28,.1)" }}>
        {[
          { k: "Month-to-date billable", v: money(mtdBillable, currency), c: brand.oxblood },
          { k: "Uninvoiced hours", v: uninvoicedHours.toString(), c: brand.ink },
          { k: "Outstanding", v: money(outstanding, currency), c: brand.ink },
        ].map((s, i) => (
          <div key={s.k} className="px-9 py-5" style={{ borderRight: i < 2 ? "1px solid rgba(74,14,28,.1)" : "none" }}>
            <div className="uppercase" style={{ fontSize: 10, letterSpacing: ".1em", color: "rgba(26,26,26,.4)" }}>
              {s.k}
            </div>
            <div className="font-display" style={{ fontSize: 24, marginTop: 3, color: s.c }}>
              {s.v}
            </div>
          </div>
        ))}
      </div>

      {/* header */}
      <div
        className="grid px-9 pb-2.5 pt-3.5 uppercase"
        style={{ gridTemplateColumns: grid, columnGap: 16, fontSize: 9.5, letterSpacing: ".1em", color: "rgba(26,26,26,.4)" }}
      >
        <div>Number</div>
        <div>Client</div>
        <div>Period</div>
        <div className="text-right">Total</div>
        <div className="text-right">Status</div>
      </div>

      <div>
        {rows.length === 0 && (
          <div className="px-9 py-8 text-sm" style={{ color: "rgba(26,26,26,.4)" }}>
            No invoices yet.
          </div>
        )}
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/invoices/${r.id}`}
            className="grid items-center px-9"
            style={{ gridTemplateColumns: grid, columnGap: 16, padding: "15px 36px", borderTop: "1px solid rgba(26,26,26,.08)" }}
          >
            <div style={{ fontFamily: "var(--font-plex)", fontSize: 12.5, color: brand.oxblood }}>{r.number}</div>
            <div style={{ fontSize: 13 }}>
              {r.client}
              {r.engagement !== "hourly" && (
                <span style={{ fontSize: 10, color: "rgba(26,26,26,.4)" }}> · {r.engagement}</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "rgba(26,26,26,.55)" }}>{r.period}</div>
            <div className="text-right" style={{ fontFamily: "var(--font-plex)", fontSize: 12.5 }}>
              {money(r.total, r.currency)}
            </div>
            <div className="text-right">
              <StatusBadge status={r.status} />
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

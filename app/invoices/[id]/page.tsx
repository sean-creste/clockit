import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui";
import { brand } from "@/lib/brand";
import { money, hoursLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInvoiceGroups } from "@/lib/invoice";
import { InvoiceActions } from "./invoice-actions";

function d(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, { ...opts, timeZone: "UTC" });
}

export default async function InvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: inv } = await admin
    .from("invoices")
    .select("id, invoice_number, period_start, period_end, issue_date, due_date, currency, subtotal, total, status, clients(name, payment_terms_days)")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const { data: entries } = await admin
    .from("time_entries")
    .select("hours, bill_rate, cost_rate, work_streams(name), resources(name), purchase_orders(po_number)")
    .eq("invoice_id", id);

  const { groups, totalHours, totalAmount, totalCost } = buildInvoiceGroups(entries ?? []);
  const poNumbers = [
    ...new Set(
      (entries ?? [])
        .map((e) => (e.purchase_orders as { po_number?: string } | null)?.po_number)
        .filter(Boolean) as string[],
    ),
  ];
  const currency = (inv.currency as string) ?? "USD";
  const client = (inv.clients as { name?: string } | null)?.name ?? "";
  const margin = totalAmount - totalCost;
  const marginPct = totalAmount > 0 ? Math.round((margin / totalAmount) * 100) : 0;
  const isAdmin = true;

  return (
    <AppShell active="invoices" section={`invoices / ${inv.invoice_number}`} userName={resource.name} role="admin">
      {/* header band */}
      <div
        className="flex items-start justify-between px-10 pb-6 pt-8"
        style={{ borderBottom: "1px solid rgba(74,14,28,.16)" }}
      >
        <div>
          <div className="font-display text-oxblood" style={{ fontSize: 30, letterSpacing: ".18em", lineHeight: 1 }}>
            {brand.wordmark}
          </div>
          <div className="mt-3.5 uppercase" style={{ fontSize: 11, letterSpacing: ".14em", color: "rgba(26,26,26,.45)" }}>
            Invoice
          </div>
          <div style={{ fontFamily: "var(--font-plex)", fontSize: 15, marginTop: 3 }}>{inv.invoice_number}</div>
        </div>
        <div className="text-right">
          <StatusBadge status={inv.status as string} />
          <div className="mt-4" style={{ fontSize: 12, color: "rgba(26,26,26,.55)", lineHeight: 1.9 }}>
            <div>
              Billed to <span style={{ color: brand.ink, fontWeight: 600 }}>{client}</span>
            </div>
            <div>
              Period {d(inv.period_start as string, { month: "short", day: "numeric" })} – {d(inv.period_end as string, { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div>
              Issued {d(inv.issue_date as string, { month: "short", day: "numeric" })} · Due {d(inv.due_date as string, { month: "short", day: "numeric" })}
            </div>
            {poNumbers.length > 0 && (
              <div>
                PO <span style={{ color: brand.ink }}>{poNumbers.join(", ")}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* summary strip */}
      <div
        className={`grid ${isAdmin ? "grid-cols-3" : "grid-cols-2"}`}
        style={{ borderBottom: "1px solid rgba(74,14,28,.1)" }}
      >
        <div className="px-10 py-5" style={{ borderRight: "1px solid rgba(74,14,28,.1)" }}>
          <div className="uppercase" style={{ fontSize: 10.5, letterSpacing: ".1em", color: "rgba(26,26,26,.45)" }}>Hours</div>
          <div className="font-display" style={{ fontSize: 28, marginTop: 4 }}>{hoursLabel(totalHours)}</div>
        </div>
        <div className="px-10 py-5" style={{ borderRight: isAdmin ? "1px solid rgba(74,14,28,.1)" : "none" }}>
          <div className="uppercase" style={{ fontSize: 10.5, letterSpacing: ".1em", color: "rgba(26,26,26,.45)" }}>Amount due</div>
          <div className="font-display text-oxblood" style={{ fontSize: 28, marginTop: 4 }}>{money(Number(inv.total), currency)}</div>
        </div>
        {isAdmin && (
          <div className="px-10 py-5">
            <div className="uppercase" style={{ fontSize: 10.5, letterSpacing: ".1em", color: "rgba(26,26,26,.45)" }}>Margin</div>
            <div className="font-display" style={{ fontSize: 28, marginTop: 4 }}>
              {money(margin, currency)}{" "}
              <span style={{ fontFamily: "var(--font-plex)", fontSize: 12, color: "rgba(26,26,26,.45)" }}>{marginPct}%</span>
            </div>
          </div>
        )}
      </div>

      {/* line items grouped by work stream */}
      <div className="px-10 pb-8">
        {groups.length === 0 && (
          <div className="py-8 text-sm" style={{ color: "rgba(26,26,26,.4)" }}>
            No line items (this invoice bills a flat amount, not hourly).
          </div>
        )}
        {groups.map((g) => (
          <div key={g.stream}>
            <div
              className="flex items-baseline justify-between"
              style={{ padding: "20px 0 10px", borderBottom: "1px solid rgba(26,26,26,.1)" }}
            >
              <div className="font-display" style={{ fontSize: 19 }}>{g.stream}</div>
              <div style={{ fontFamily: "var(--font-plex)", fontSize: 13 }}>
                {hoursLabel(g.hours)}h · {money(g.amount, currency)}
              </div>
            </div>
            <div
              className="grid"
              style={{ gridTemplateColumns: "1fr auto auto auto", columnGap: 22, rowGap: 11, padding: "14px 0", fontFamily: "var(--font-plex)", fontSize: 12.5 }}
            >
              {g.resources.map((r) => (
                <div key={r.name} className="contents">
                  <div style={{ color: brand.ink }}>{r.name}</div>
                  <div className="text-right" style={{ color: "rgba(26,26,26,.5)" }}>{hoursLabel(r.hours)}h</div>
                  <div className="text-right" style={{ color: "rgba(26,26,26,.5)" }}>{money(r.rate, currency)}</div>
                  <div className="text-right" style={{ color: brand.ink }}>{money(r.amount, currency)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* total */}
        <div
          className="flex items-baseline justify-between"
          style={{ marginTop: 22, paddingTop: 18, borderTop: "2px solid " + brand.oxblood }}
        >
          <div className="uppercase" style={{ fontSize: 11, letterSpacing: ".12em", color: "rgba(26,26,26,.5)" }}>
            Total due · {currency}
          </div>
          <div className="font-display text-oxblood" style={{ fontSize: 32 }}>{money(Number(inv.total), currency)}</div>
        </div>
      </div>

      <InvoiceActions id={inv.id as string} status={inv.status as string} />
      <div className="px-10 pb-6">
        <Link href="/invoices" className="text-xs underline" style={{ color: "rgba(26,26,26,.45)" }}>
          ‹ All invoices
        </Link>
      </div>
    </AppShell>
  );
}

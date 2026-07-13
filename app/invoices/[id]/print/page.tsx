import { redirect, notFound } from "next/navigation";
import { brand } from "@/lib/brand";
import { money, hoursLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildInvoiceGroups } from "@/lib/invoice";
import { PrintBar } from "./print-bar";

function fdate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const muted = (o: number) => `rgba(26,26,26,${o})`;

export default async function InvoicePrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("resources")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") redirect("/time");

  const { data: inv } = await admin
    .from("invoices")
    .select("invoice_number, period_start, period_end, issue_date, due_date, currency, subtotal, total, clients(name, payment_terms_days)")
    .eq("id", id)
    .maybeSingle();
  if (!inv) notFound();

  const { data: entries } = await admin
    .from("time_entries")
    .select("hours, bill_rate, cost_rate, work_streams(name), resources(name), purchase_orders(po_number)")
    .eq("invoice_id", id);

  const { groups } = buildInvoiceGroups(entries ?? []);
  const poNumbers = [
    ...new Set(
      (entries ?? [])
        .map((e) => (e.purchase_orders as { po_number?: string } | null)?.po_number)
        .filter(Boolean) as string[],
    ),
  ];
  const currency = (inv.currency as string) ?? "USD";
  const client = inv.clients as { name?: string; payment_terms_days?: number } | null;
  const terms = client?.payment_terms_days ?? 30;

  return (
    <main className="min-h-screen py-8">
      <PrintBar backHref={`/invoices/${id}`} />

      {/* invoice sheet */}
      <div
        className="mx-auto bg-white"
        style={{
          maxWidth: 800,
          padding: "54px 56px",
          boxShadow: "0 12px 40px -18px rgba(74,14,28,.35)",
        }}
      >
        {/* masthead */}
        <div className="flex items-start justify-between" style={{ paddingBottom: 20, borderBottom: `2px solid ${brand.oxblood}` }}>
          <div>
            <div className="font-display" style={{ fontSize: 38, letterSpacing: ".2em", color: brand.oxblood, lineHeight: 1 }}>
              {brand.wordmark}
            </div>
            <div style={{ marginTop: 10, fontSize: 9.5, letterSpacing: ".1em", color: muted(0.5), lineHeight: 1.7 }}>
              Creste Studio LLC · UBI 000-000-000
              <br />
              EIN 00-0000000
            </div>
          </div>
          <div className="text-right">
            <div className="font-display" style={{ fontSize: 22, fontStyle: "italic" }}>
              Invoice
            </div>
            <div style={{ fontFamily: "var(--font-plex)", fontSize: 12, color: brand.oxblood, marginTop: 4 }}>
              {inv.invoice_number}
            </div>
          </div>
        </div>

        {/* meta grid */}
        <div className="grid grid-cols-2 gap-7" style={{ marginTop: 28 }}>
          <div>
            <div className="uppercase" style={{ fontSize: 9, letterSpacing: ".14em", color: muted(0.4) }}>
              Billed to
            </div>
            <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600 }}>{client?.name}</span>
            </div>
          </div>
          <div className="text-right" style={{ fontSize: 11, color: muted(0.6), lineHeight: 2 }}>
            <div>
              Period <span style={{ color: brand.ink }}>{fdate(inv.period_start as string)} – {fdate(inv.period_end as string)}</span>
            </div>
            <div>
              Issued <span style={{ color: brand.ink }}>{fdate(inv.issue_date as string)}</span>
            </div>
            <div>
              Due <span style={{ color: brand.ink }}>{fdate(inv.due_date as string)}</span>
            </div>
            <div>
              Terms <span style={{ color: brand.ink }}>Net-{terms} · {currency}</span>
            </div>
            {poNumbers.length > 0 && (
              <div>
                PO <span style={{ color: brand.ink }}>{poNumbers.join(", ")}</span>
              </div>
            )}
          </div>
        </div>

        {/* table header */}
        <div
          className="grid uppercase"
          style={{ gridTemplateColumns: "1fr 70px 70px 100px", columnGap: 20, marginTop: 34, paddingBottom: 9, borderBottom: `1px solid ${muted(0.25)}`, fontSize: 9, letterSpacing: ".12em", color: muted(0.45) }}
        >
          <div>Work stream / resource</div>
          <div className="text-right">Hours</div>
          <div className="text-right">Rate</div>
          <div className="text-right">Amount</div>
        </div>

        {/* groups */}
        {groups.length === 0 ? (
          <div style={{ marginTop: 18, fontSize: 12, color: muted(0.5) }}>
            Flat-fee engagement — {money(Number(inv.total), currency)}.
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.stream}>
              <div style={{ fontFamily: "var(--font-archivo)", fontSize: 12, fontWeight: 600, color: brand.oxblood, padding: "14px 0 4px" }}>
                {g.stream}
              </div>
              {g.resources.map((r) => (
                <div
                  key={r.name}
                  className="grid"
                  style={{ gridTemplateColumns: "1fr 70px 70px 100px", columnGap: 20, padding: "5px 0", fontFamily: "var(--font-plex)", fontSize: 11, color: muted(0.8) }}
                >
                  <div>{r.name}</div>
                  <div className="text-right">{hoursLabel(r.hours)}</div>
                  <div className="text-right">{money(r.rate, currency)}</div>
                  <div className="text-right">{money(r.amount, currency)}</div>
                </div>
              ))}
            </div>
          ))
        )}

        {/* totals */}
        <div style={{ marginTop: 30 }}>
          <div className="flex justify-end" style={{ gap: 50, padding: "7px 0", fontSize: 11, color: muted(0.6) }}>
            <div>Subtotal</div>
            <div style={{ fontFamily: "var(--font-plex)", color: brand.ink, minWidth: 110, textAlign: "right" }}>
              {money(Number(inv.subtotal), currency)}
            </div>
          </div>
          <div className="flex items-baseline justify-end" style={{ gap: 50, padding: "12px 0", marginTop: 6, borderTop: `2px solid ${brand.oxblood}` }}>
            <div className="uppercase" style={{ fontSize: 11, letterSpacing: ".1em", color: brand.oxblood }}>
              Total due
            </div>
            <div className="font-display" style={{ fontSize: 26, color: brand.oxblood, minWidth: 110, textAlign: "right" }}>
              {money(Number(inv.total), currency)}
            </div>
          </div>
          <div style={{ marginTop: 26, fontSize: 9.5, color: muted(0.4), lineHeight: 1.7, textAlign: "center" }}>
            Remit within {terms} days · ACH details on file · Thank you for working with Creste.
          </div>
        </div>
      </div>
    </main>
  );
}

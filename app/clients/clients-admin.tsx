"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/brand";
import { money, hoursLabel } from "@/lib/format";
import { Btn, CardHeader, StatusBadge, Label } from "@/components/ui";
import { createClientRecord, createWorkStream } from "./actions";
import { POPanel, type PO } from "./po-panel";

type Stream = {
  id: string;
  name: string;
  slug: string;
  budgetHours: number | null;
  budgetAmount: number | null;
  active: boolean;
  logged: number;
};
type Client = {
  id: string;
  name: string;
  currency: string;
  engagement: string;
  paymentTermsDays: number;
  billingEmail: string;
  retainerAmount: number | null;
  active: boolean;
  streams: Stream[];
  pos: PO[];
};

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  background: "#fff",
  border: "1px solid rgba(26,26,26,.2)",
  borderRadius: 5,
  padding: "10px 12px",
  color: brand.ink,
  outline: "none",
  width: "100%",
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function engagementLabel(c: Client) {
  if (c.engagement === "retainer")
    return c.retainerAmount ? `Retainer · ${money(c.retainerAmount, c.currency)}/mo` : "Retainer";
  if (c.engagement === "fixed_fee") return "Fixed fee";
  if (c.engagement === "equity") return "Equity";
  return "Hourly";
}

function BudgetBar({ logged, budget }: { logged: number; budget: number | null }) {
  if (budget == null)
    return (
      <span style={{ fontFamily: "var(--font-plex)", fontSize: 10.5, color: "rgba(26,26,26,.5)" }}>
        {hoursLabel(logged)}h logged
      </span>
    );
  const pct = Math.min(100, budget > 0 ? (logged / budget) * 100 : 0);
  const over = logged > budget;
  return (
    <div className="flex items-center gap-2.5">
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(26,26,26,.1)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: over ? brand.danger : brand.oxblood }} />
      </div>
      <span style={{ fontFamily: "var(--font-plex)", fontSize: 10.5, color: over ? brand.danger : "rgba(26,26,26,.5)" }}>
        {hoursLabel(logged)} / {hoursLabel(budget)}h
      </span>
    </div>
  );
}

export function ClientsAdmin({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [streamFor, setStreamFor] = useState<string | null>(null);

  const totalStreams = clients.reduce((s, c) => s + c.streams.length, 0);

  // new-client form state
  const [cName, setCName] = useState("");
  const [cCurrency, setCCurrency] = useState("ILS");
  const [cEngagement, setCEngagement] = useState("hourly");
  const [cTerms, setCTerms] = useState("30");
  const [cEmail, setCEmail] = useState("");

  // new-stream form state
  const [sName, setSName] = useState("");
  const [sSlug, setSSlug] = useState("");
  const [sBudgetH, setSBudgetH] = useState("");
  const [sBudgetA, setSBudgetA] = useState("");

  function submitClient() {
    setMsg(null);
    start(async () => {
      const res = await createClientRecord({
        name: cName,
        currency: cCurrency,
        engagement: cEngagement,
        paymentTermsDays: Number(cTerms) || 30,
        billingEmail: cEmail,
      });
      if (res?.error) setMsg(res.error);
      else {
        setNewClient(false);
        setCName("");
        setCEmail("");
        router.refresh();
      }
    });
  }

  function submitStream(clientId: string) {
    setMsg(null);
    start(async () => {
      const res = await createWorkStream({
        clientId,
        name: sName,
        slug: sSlug || slugify(sName),
        budgetHours: sBudgetH,
        budgetAmount: sBudgetA,
      });
      if (res?.error) setMsg(res.error);
      else {
        setStreamFor(null);
        setSName("");
        setSSlug("");
        setSBudgetH("");
        setSBudgetA("");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <CardHeader
        title="Clients"
        subtitle={`${clients.filter((c) => c.active).length} active · ${totalStreams} work streams`}
        right={
          <Btn onClick={() => setNewClient((v) => !v)}>{newClient ? "Close" : "+ New client"}</Btn>
        }
      />

      {msg && (
        <div className="px-9 pt-3 text-sm" style={{ color: brand.open }}>
          {msg}
        </div>
      )}

      {newClient && (
        <div className="px-9 py-5" style={{ borderBottom: "1px solid rgba(26,26,26,.08)", background: "rgba(74,14,28,.03)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Client name</Label>
              <input style={inputStyle} value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Acme Inc." />
            </div>
            <div>
              <Label>Currency</Label>
              <select style={inputStyle} value={cCurrency} onChange={(e) => setCCurrency(e.target.value)}>
                {["ILS", "USD", "EUR", "GBP"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Engagement</Label>
              <select style={inputStyle} value={cEngagement} onChange={(e) => setCEngagement(e.target.value)}>
                {["hourly", "retainer", "fixed_fee", "equity"].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Payment terms (days)</Label>
              <input style={inputStyle} value={cTerms} onChange={(e) => setCTerms(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <Label>Billing email</Label>
              <input style={inputStyle} value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="billing@…" />
            </div>
          </div>
          <div className="mt-4 flex gap-2.5">
            <Btn onClick={submitClient} disabled={pending}>
              Create client
            </Btn>
            <Btn variant="ghost" onClick={() => setNewClient(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {clients.map((c) => (
        <div key={c.id} className="px-9 py-6" style={{ borderBottom: "1px solid rgba(26,26,26,.08)" }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-display" style={{ fontSize: 20 }}>
                  {c.name}
                </span>
                <StatusBadge status={c.engagement} label={engagementLabel(c)} />
                {!c.active && <StatusBadge status="void" label="inactive" />}
              </div>
              <div className="mt-1.5" style={{ fontSize: 11.5, color: "rgba(26,26,26,.5)" }}>
                Net-{c.paymentTermsDays} · {c.currency}
                {c.billingEmail && ` · ${c.billingEmail}`}
              </div>
            </div>
            <Btn variant="accent" small onClick={() => setStreamFor((v) => (v === c.id ? null : c.id))}>
              + Stream
            </Btn>
          </div>

          {streamFor === c.id && (
            <div className="mt-4 rounded-md p-4" style={{ background: "rgba(74,14,28,.03)", border: "1px solid rgba(74,14,28,.12)" }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Stream name</Label>
                  <input
                    style={inputStyle}
                    value={sName}
                    onChange={(e) => {
                      setSName(e.target.value);
                      setSSlug(slugify(e.target.value));
                    }}
                    placeholder="Dashboard UI"
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <input
                    style={{ ...inputStyle, fontFamily: "var(--font-plex)", color: brand.oxblood }}
                    value={sSlug}
                    onChange={(e) => setSSlug(e.target.value)}
                    placeholder="dashboard-ui"
                  />
                </div>
                <div>
                  <Label>Budget hours</Label>
                  <input style={inputStyle} value={sBudgetH} onChange={(e) => setSBudgetH(e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <Label>Budget amount</Label>
                  <input style={inputStyle} value={sBudgetA} onChange={(e) => setSBudgetA(e.target.value)} inputMode="decimal" />
                </div>
              </div>
              <div className="mt-4 flex gap-2.5">
                <Btn onClick={() => submitStream(c.id)} disabled={pending}>
                  Create stream
                </Btn>
                <Btn variant="ghost" onClick={() => setStreamFor(null)}>
                  Cancel
                </Btn>
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col">
            {c.streams.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(26,26,26,.4)" }}>No work streams yet.</div>
            )}
            {c.streams.map((s) => (
              <div
                key={s.id}
                className="grid items-center"
                style={{
                  gridTemplateColumns: "200px 1fr 120px 70px",
                  columnGap: 16,
                  padding: "11px 0",
                  borderTop: "1px solid rgba(26,26,26,.07)",
                }}
              >
                <div style={{ fontSize: 12.5 }}>
                  {s.name}{" "}
                  <span style={{ fontFamily: "var(--font-plex)", fontSize: 10, color: "rgba(26,26,26,.4)" }}>
                    /{s.slug}
                  </span>
                </div>
                <BudgetBar logged={s.logged} budget={s.budgetHours} />
                <div className="text-right" style={{ fontFamily: "var(--font-plex)", fontSize: 11.5, color: "rgba(26,26,26,.6)" }}>
                  {s.budgetAmount != null ? money(s.budgetAmount, c.currency) : "—"}
                </div>
                <div className="text-right">
                  <StatusBadge status={s.active ? "active" : "void"} label={s.active ? "Active" : "Off"} />
                </div>
              </div>
            ))}
          </div>

          <POPanel clientId={c.id} currency={c.currency} pos={c.pos} />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/brand";
import { money } from "@/lib/format";
import { Btn, StatusBadge, Label } from "@/components/ui";
import { createPurchaseOrder, uploadAgreement, agreementUrl } from "./po-actions";

export type PODoc = { id: string; name: string; path: string; sizeBytes: number | null };
export type PO = {
  id: string;
  poNumber: string;
  description: string;
  amount: number | null;
  currency: string;
  status: string;
  issueDate: string | null;
  expiryDate: string | null;
  billed: number;
  documents: PODoc[];
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

function Burndown({ billed, amount, currency }: { billed: number; amount: number | null; currency: string }) {
  if (amount == null || amount <= 0)
    return (
      <span style={{ fontFamily: "var(--font-plex)", fontSize: 10.5, color: "rgba(26,26,26,.5)" }}>
        {money(billed, currency)} billed
      </span>
    );
  const pct = Math.min(100, (billed / amount) * 100);
  const over = billed > amount;
  return (
    <div className="flex items-center gap-2.5">
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(26,26,26,.1)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: over ? brand.danger : brand.oxblood }} />
      </div>
      <span style={{ fontFamily: "var(--font-plex)", fontSize: 10.5, color: over ? brand.danger : "rgba(26,26,26,.5)" }}>
        {money(billed, currency)} / {money(amount, currency)}
      </span>
    </div>
  );
}

export function POPanel({
  clientId,
  currency,
  pos,
}: {
  clientId: string;
  currency: string;
  pos: PO[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [num, setNum] = useState("");
  const [amount, setAmount] = useState("");
  const [issue, setIssue] = useState("");
  const [expiry, setExpiry] = useState("");
  const [desc, setDesc] = useState("");

  function addPO() {
    setMsg(null);
    start(async () => {
      const res = await createPurchaseOrder({
        clientId,
        poNumber: num,
        description: desc,
        amount,
        currency,
        issueDate: issue,
        expiryDate: expiry,
      });
      if (res?.error) setMsg(res.error);
      else {
        setShowAdd(false);
        setNum(""); setAmount(""); setIssue(""); setExpiry(""); setDesc("");
        router.refresh();
      }
    });
  }

  function upload(poId: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    setMsg(null);
    const fd = new FormData();
    fd.set("poId", poId);
    fd.set("file", file);
    start(async () => {
      const res = await uploadAgreement(fd);
      if (res?.error) setMsg(res.error);
      else {
        input.value = "";
        router.refresh();
      }
    });
  }

  async function openDoc(path: string) {
    const res = await agreementUrl(path);
    if (res.url) window.open(res.url, "_blank", "noopener");
    else setMsg(res.error ?? "Could not open document.");
  }

  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: "rgba(74,14,28,.12)" }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="uppercase" style={{ fontSize: 10, letterSpacing: ".1em", color: "rgba(26,26,26,.45)" }}>
          Purchase orders
        </span>
        <Btn variant="accent" small onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Close" : "+ Add PO"}
        </Btn>
      </div>

      {msg && (
        <p className="mb-2 text-sm" style={{ color: brand.open }}>
          {msg}
        </p>
      )}

      {showAdd && (
        <div className="mb-3 rounded-md p-4" style={{ background: "rgba(74,14,28,.03)", border: "1px solid rgba(74,14,28,.12)" }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>PO number</Label>
              <input style={inputStyle} value={num} onChange={(e) => setNum(e.target.value)} placeholder="PO-2026-014" />
            </div>
            <div>
              <Label>Amount ({currency})</Label>
              <input style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="optional cap" />
            </div>
            <div>
              <Label>Issue date</Label>
              <input type="date" style={inputStyle} value={issue} onChange={(e) => setIssue(e.target.value)} />
            </div>
            <div>
              <Label>Expiry date</Label>
              <input type="date" style={inputStyle} value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Description</Label>
              <input style={inputStyle} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Scope / notes" />
            </div>
          </div>
          <div className="mt-3 flex gap-2.5">
            <Btn onClick={addPO} disabled={pending}>Create PO</Btn>
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
          </div>
        </div>
      )}

      {pos.length === 0 && !showAdd && (
        <p style={{ fontSize: 12, color: "rgba(26,26,26,.4)" }}>No purchase orders yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {pos.map((po) => (
          <div key={po.id} className="rounded-md p-3" style={{ border: "1px solid rgba(26,26,26,.1)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span style={{ fontFamily: "var(--font-plex)", fontSize: 13, color: brand.oxblood }}>{po.poNumber}</span>
                <StatusBadge status={po.status === "active" ? "active" : po.status} label={po.status} />
                {po.expiryDate && (
                  <span style={{ fontSize: 11, color: "rgba(26,26,26,.4)" }}>exp {po.expiryDate}</span>
                )}
              </div>
              <div style={{ minWidth: 200 }}>
                <Burndown billed={po.billed} amount={po.amount} currency={po.currency} />
              </div>
            </div>
            {po.description && (
              <p className="mt-1.5" style={{ fontSize: 11.5, color: "rgba(26,26,26,.6)" }}>{po.description}</p>
            )}

            {/* documents */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {po.documents.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openDoc(d.path)}
                  className="rounded"
                  style={{ fontSize: 11, color: brand.oxblood, border: "1px solid rgba(74,14,28,.25)", padding: "3px 9px" }}
                  title="Open signed agreement"
                >
                  📄 {d.name}
                </button>
              ))}
              <label
                className="cursor-pointer rounded"
                style={{ fontSize: 11, color: "rgba(26,26,26,.6)", border: "1px dashed rgba(26,26,26,.25)", padding: "3px 9px" }}
              >
                + Upload agreement
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => upload(po.id, e.currentTarget)}
                  disabled={pending}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

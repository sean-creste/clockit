"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui";
import { brand } from "@/lib/brand";
import { markInvoicePaid } from "../actions";

export function InvoiceActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2.5 px-10 pb-4">
      <Btn href={`/invoices/${id}/print`}>Print / Save PDF</Btn>
      <Btn variant="accent" onClick={() => setMsg("Email sending isn't wired up yet.")}>
        Email to client
      </Btn>
      {status !== "paid" ? (
        <Btn
          variant="ghost"
          className="ml-auto"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await markInvoicePaid(id);
              if (r?.error) setMsg(r.error);
              else router.refresh();
            })
          }
        >
          {pending ? "…" : "Mark paid"}
        </Btn>
      ) : (
        <span className="ml-auto text-xs" style={{ color: brand.active }}>
          Paid
        </span>
      )}
      {msg && (
        <span className="w-full text-right text-[11px]" style={{ color: brand.oxblood }}>
          {msg}
        </span>
      )}
    </div>
  );
}

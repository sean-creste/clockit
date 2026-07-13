"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/ui";
import { brand } from "@/lib/brand";
import { generateInvoices } from "./actions";

export function GenerateButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run() {
    setMsg(null);
    start(async () => {
      const res = await generateInvoices(); // §4 default: prior month
      if (res.error) setMsg(res.error);
      else {
        setMsg(
          res.count
            ? `Generated ${res.count} invoice${res.count === 1 ? "" : "s"}.`
            : "Nothing to generate — all billable hours are already invoiced.",
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Btn onClick={run} disabled={pending}>
        {pending ? "Generating…" : `Generate for ${label}`}
      </Btn>
      {msg && (
        <span className="text-right text-[11px]" style={{ color: brand.oxblood, maxWidth: 220 }}>
          {msg}
        </span>
      )}
    </div>
  );
}

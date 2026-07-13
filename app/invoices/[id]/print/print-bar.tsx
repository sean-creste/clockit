"use client";

import Link from "next/link";
import { Btn } from "@/components/ui";

export function PrintBar({ backHref }: { backHref: string }) {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between px-2">
      <Link href={backHref} className="text-xs underline" style={{ color: "rgba(26,26,26,.5)" }}>
        ‹ Back to invoice
      </Link>
      <Btn onClick={() => window.print()}>Save as PDF / Print</Btn>
    </div>
  );
}

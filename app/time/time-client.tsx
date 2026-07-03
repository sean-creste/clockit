"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { addEntry } from "./actions";

type Stream = { id: string; name: string; clientName: string };
type Entry = {
  id: string;
  entryDate: string;
  hours: number;
  description: string;
  billable: boolean;
  invoiced: boolean;
  streamName: string;
  clientName: string;
};

function todayISO() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);
}

const fmtDay = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export function TimeClient({
  resourceName,
  streams,
  entries,
  weekStart,
  weekEnd,
}: {
  resourceName: string;
  streams: Stream[];
  entries: Entry[];
  weekStart: string;
  weekEnd: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const [entryDate, setEntryDate] = useState(todayISO());
  const [workStreamId, setWorkStreamId] = useState(streams[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);

  const { byDay, weekTotal } = useMemo(() => {
    const map = new Map<string, Entry[]>();
    let total = 0;
    for (const e of entries) {
      total += e.hours;
      const arr = map.get(e.entryDate) ?? [];
      arr.push(e);
      map.set(e.entryDate, arr);
    }
    const byDay = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    return { byDay, weekTotal: total };
  }, [entries]);

  function submit() {
    setMsg(null);
    const h = Number(hours);
    if (!workStreamId) return setMsg("Pick a work stream.");
    if (!(h > 0 && h <= 24)) return setMsg("Hours must be between 0 and 24.");
    start(async () => {
      const res = await addEntry({
        entryDate,
        workStreamId,
        hours: h,
        description,
        billable,
      });
      if (res?.error) setMsg(res.error);
      else {
        setHours("");
        setDescription("");
        router.refresh();
      }
    });
  }

  const input =
    "rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-zinc-400";

  return (
    <main className="min-h-screen p-6 md:p-10" style={{ backgroundColor: brand.ink }}>
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white" style={{ letterSpacing: "0.2em" }}>
              {brand.wordmark}
            </h1>
            <p className="text-sm text-zinc-400">Log time — {resourceName}</p>
          </div>
          <Link href="/" className="text-sm text-zinc-400 underline">
            Home
          </Link>
        </header>

        {/* Entry form — no <form>, handlers only */}
        <section className="rounded-xl border border-zinc-800 bg-black/30 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Date
              <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Work stream
              <select value={workStreamId} onChange={(e) => setWorkStreamId(e.target.value)} className={input}>
                {streams.length === 0 && <option value="">No streams available</option>}
                {streams.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.clientName} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Hours
              <input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 2.5"
                className={input}
              />
            </label>
            <label className="flex items-end gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="h-4 w-4" />
              Billable
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400 sm:col-span-2">
              Description
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What did you work on?"
                className={input}
              />
            </label>
          </div>
          {msg && <p className="mt-3 text-sm text-amber-400">{msg}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={pending || streams.length === 0}
            className="mt-4 rounded-md px-4 py-2 font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: brand.oxblood }}
          >
            {pending ? "Adding…" : "Add entry"}
          </button>
        </section>

        {/* This week */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between border-b border-zinc-800 pb-2">
            <h2 className="text-sm uppercase tracking-wide text-zinc-400">
              This week · {fmtDay(weekStart)} – {fmtDay(weekEnd)}
            </h2>
            <span className="text-sm text-zinc-300">
              Total <span className="font-semibold text-white">{weekTotal}</span> h
            </span>
          </div>

          {byDay.length === 0 && <p className="text-sm text-zinc-500">No entries yet this week.</p>}

          {byDay.map(([day, list]) => {
            const dayTotal = list.reduce((s, e) => s + e.hours, 0);
            return (
              <div key={day} className="mb-4">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-200">{fmtDay(day)}</span>
                  <span className="text-zinc-400">{dayTotal} h</span>
                </div>
                <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
                  {list.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate text-zinc-200">
                          {e.description || <span className="text-zinc-500">—</span>}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {e.clientName} · {e.streamName}
                          {!e.billable && " · non-billable"}
                          {e.invoiced && (
                            <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                              invoiced · read-only
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 tabular-nums text-zinc-200">{e.hours} h</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

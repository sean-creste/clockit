"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { hoursLabel, money } from "@/lib/format";
import { addEntry } from "./actions";

type Stream = { id: string; name: string; clientId: string; clientName: string };
type Po = { id: string; poNumber: string };
type Entry = {
  id: string;
  hours: number;
  description: string;
  billable: boolean;
  invoiced: boolean;
  streamName: string;
  clientName: string;
  currency: string;
  billRate: number;
  poNumber: string | null;
};

export function TimeDay({
  day,
  weekday,
  dateLabel,
  prevDate,
  nextDate,
  today,
  dayTotal,
  entries,
  streams,
  poByClient,
  isAdmin,
}: {
  day: string;
  weekday: string;
  dateLabel: string;
  prevDate: string;
  nextDate: string;
  today: string;
  dayTotal: number;
  entries: Entry[];
  streams: Stream[];
  poByClient: Record<string, Po[]>;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [streamId, setStreamId] = useState(streams[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [poId, setPoId] = useState("");

  const selectedStream = streams.find((s) => s.id === streamId);
  const clientPos = selectedStream ? poByClient[selectedStream.clientId] ?? [] : [];
  const poRequired = clientPos.length > 0;

  const grid = isAdmin
    ? "180px 1fr 70px 90px 44px"
    : "180px 1fr 70px 44px";

  function add() {
    setMsg(null);
    const h = Number(hours);
    if (!streamId) return setMsg("Pick a work stream.");
    if (!(h > 0 && h <= 24)) return setMsg("Hours must be between 0 and 24.");
    if (poRequired && !poId) return setMsg("This client requires a PO — pick one.");
    start(async () => {
      const res = await addEntry({
        entryDate: day,
        workStreamId: streamId,
        hours: h,
        description,
        billable: true,
        poId: poId || null,
      });
      if (res?.error) setMsg(res.error);
      else {
        setHours("");
        setDescription("");
        setPoId("");
        router.refresh();
      }
    });
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className="inline-flex h-7 w-7 items-center justify-center rounded"
      style={{ color: "rgba(26,26,26,.5)", border: "1px solid rgba(26,26,26,.12)" }}
    >
      {label}
    </Link>
  );

  return (
    <div>
      {/* day nav + total */}
      <div className="flex items-end justify-between px-9 pb-5 pt-7">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {navLink(`/time?date=${prevDate}`, "‹")}
            {navLink(`/time?date=${nextDate}`, "›")}
          </div>
          <div>
            <div
              className="uppercase"
              style={{ fontSize: 11, letterSpacing: ".12em", color: "rgba(26,26,26,.4)" }}
            >
              {weekday}
              {day !== today && (
                <Link href="/time" className="ml-2 normal-case underline" style={{ letterSpacing: 0 }}>
                  today
                </Link>
              )}
            </div>
            <div className="font-display" style={{ fontSize: 30, lineHeight: 1.1, marginTop: 2 }}>
              {dateLabel}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className="uppercase"
            style={{ fontSize: 11, letterSpacing: ".12em", color: "rgba(26,26,26,.4)" }}
          >
            Logged
          </div>
          <div
            className="font-display"
            style={{ fontSize: 30, lineHeight: 1.1, marginTop: 2, color: brand.oxblood }}
          >
            {hoursLabel(dayTotal)}
            <span style={{ fontSize: 16, color: "rgba(26,26,26,.4)" }}>h</span>
          </div>
        </div>
      </div>

      {/* column header */}
      <div
        className="grid px-9 pb-2 uppercase"
        style={{
          gridTemplateColumns: grid,
          columnGap: 16,
          fontSize: 9.5,
          letterSpacing: ".1em",
          color: "rgba(26,26,26,.4)",
        }}
      >
        <div>Client / stream</div>
        <div>Description</div>
        <div className="text-right">Hours</div>
        {isAdmin && <div className="text-right">Amount</div>}
        <div />
      </div>

      {/* entries */}
      <div style={{ borderTop: "1px solid rgba(26,26,26,.1)" }}>
        {entries.length === 0 && (
          <div className="px-9 py-6 text-sm" style={{ color: "rgba(26,26,26,.4)" }}>
            No entries logged this day.
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="grid items-center px-9"
            style={{
              gridTemplateColumns: grid,
              columnGap: 16,
              padding: "16px 36px",
              paddingLeft: 36,
              paddingRight: 36,
              borderBottom: "1px solid rgba(26,26,26,.07)",
              opacity: e.invoiced ? 0.6 : 1,
            }}
          >
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{e.clientName}</div>
              <div style={{ fontSize: 11, color: brand.oxblood, marginTop: 2 }}>{e.streamName}</div>
              {e.poNumber && (
                <div style={{ fontSize: 10, color: "rgba(26,26,26,.45)", fontFamily: "var(--font-plex)", marginTop: 1 }}>
                  PO {e.poNumber}
                </div>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(26,26,26,.7)", lineHeight: 1.45 }}>
              {e.description || <span style={{ color: "rgba(26,26,26,.35)" }}>—</span>}
              {e.invoiced && (
                <span
                  className="ml-2 uppercase"
                  style={{
                    fontFamily: "var(--font-plex)",
                    fontSize: 9.5,
                    letterSpacing: ".06em",
                    color: brand.oxblood,
                    border: "1px solid rgba(74,14,28,.3)",
                    borderRadius: 3,
                    padding: "1px 5px",
                  }}
                >
                  Billed
                </span>
              )}
              {!e.billable && (
                <span className="ml-2" style={{ fontSize: 10, color: "rgba(26,26,26,.4)" }}>
                  non-billable
                </span>
              )}
            </div>
            <div
              className="text-right"
              style={{ fontFamily: "var(--font-plex)", fontSize: 13 }}
            >
              {hoursLabel(e.hours)}
            </div>
            {isAdmin && (
              <div
                className="text-right"
                style={{ fontFamily: "var(--font-plex)", fontSize: 12.5, color: "rgba(26,26,26,.6)" }}
              >
                {money(e.hours * e.billRate, e.currency)}
              </div>
            )}
            <div className="text-right" style={{ color: "rgba(26,26,26,.3)", fontSize: 14 }}>
              {e.invoiced ? "🔒" : "⋯"}
            </div>
          </div>
        ))}
      </div>

      {/* add row */}
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: grid,
          columnGap: 16,
          padding: "14px 36px",
          background: "rgba(74,14,28,.035)",
        }}
      >
        <select
          value={streamId}
          onChange={(e) => {
            setStreamId(e.target.value);
            setPoId("");
          }}
          style={{
            fontSize: 12,
            background: "transparent",
            border: "1px solid rgba(26,26,26,.15)",
            borderRadius: 5,
            padding: "7px 8px",
            color: brand.ink,
          }}
        >
          {streams.length === 0 && <option value="">No streams</option>}
          {streams.map((s) => (
            <option key={s.id} value={s.id}>
              {s.clientName} · {s.name}
            </option>
          ))}
        </select>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What did you work on?"
          style={{
            fontSize: 12.5,
            background: "transparent",
            border: "1px solid rgba(26,26,26,.15)",
            borderRadius: 5,
            padding: "8px 10px",
            color: brand.ink,
            outline: "none",
          }}
        />
        <input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="0.0"
          inputMode="decimal"
          className="text-right"
          style={{
            fontFamily: "var(--font-plex)",
            fontSize: 13,
            background: "transparent",
            border: "1px solid rgba(26,26,26,.15)",
            borderRadius: 5,
            padding: "8px 10px",
            color: brand.ink,
            outline: "none",
            width: "100%",
          }}
        />
        {isAdmin && <div />}
        <div className="text-right">
          <button
            type="button"
            onClick={add}
            disabled={pending || streams.length === 0}
            className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-[5px] disabled:opacity-50"
            style={{ background: brand.oxblood, color: brand.light, fontSize: 16 }}
            title="Add entry"
          >
            +
          </button>
        </div>
      </div>

      {poRequired && (
        <div
          className="flex items-center gap-2 px-9 py-2"
          style={{ background: "rgba(74,14,28,.02)", borderTop: "1px solid rgba(26,26,26,.06)" }}
        >
          <span className="uppercase" style={{ fontSize: 10, letterSpacing: ".1em", color: "rgba(26,26,26,.45)" }}>
            PO
          </span>
          <select
            value={poId}
            onChange={(e) => setPoId(e.target.value)}
            style={{
              fontSize: 12,
              background: "#fff",
              border: "1px solid rgba(26,26,26,.2)",
              borderRadius: 5,
              padding: "6px 8px",
              color: brand.ink,
            }}
          >
            <option value="">Select PO…</option>
            {clientPos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.poNumber}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 10.5, color: brand.open }}>
            required for {selectedStream?.clientName}
          </span>
        </div>
      )}

      {msg && (
        <div className="px-9 py-3 text-sm" style={{ color: brand.open }}>
          {msg}
        </div>
      )}
    </div>
  );
}

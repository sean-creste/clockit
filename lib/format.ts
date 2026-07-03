// Shared formatting helpers.

const SYMBOL: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€", GBP: "£" };

export function money(amount: number, currency = "USD"): string {
  const sym = SYMBOL[currency] ?? "";
  const n = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sym}${n}`;
}

export function hoursLabel(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, "");
}

// "Mon · Jun 30, 2026"
export function longDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const wd = d.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
  const rest = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${wd} · ${rest}`;
}

// { weekday: "Monday", date: "June 30, 2026" }
export function dayParts(iso: string): { weekday: string; date: string } {
  const d = new Date(iso + "T00:00:00Z");
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" }),
    date: d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

export function addDaysISO(iso: string, delta: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

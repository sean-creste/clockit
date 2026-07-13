// Group an invoice's time entries by work stream, then by resource — the
// itemized report shape used by the invoice detail screen and the PDF (§7).

type NameRef = { name?: string } | { name?: string }[] | null;
type RawEntry = {
  hours: number | string;
  bill_rate: number | string;
  cost_rate: number | string | null;
  work_streams: NameRef;
  resources: NameRef;
};

// supabase-js types nested selects as arrays even for to-one joins; normalize.
function one(x: NameRef): { name?: string } | null {
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export type InvoiceResourceRow = {
  name: string;
  hours: number;
  amount: number;
  rate: number; // effective bill rate (amount / hours)
};
export type InvoiceGroup = {
  stream: string;
  hours: number;
  amount: number;
  cost: number;
  resources: InvoiceResourceRow[];
};

export function buildInvoiceGroups(entries: RawEntry[]) {
  const streams = new Map<
    string,
    { hours: number; amount: number; cost: number; res: Map<string, { hours: number; amount: number; cost: number }> }
  >();
  let totalHours = 0,
    totalAmount = 0,
    totalCost = 0;

  for (const e of entries) {
    const h = Number(e.hours);
    const amt = h * Number(e.bill_rate);
    const cost = h * Number(e.cost_rate ?? 0);
    totalHours += h;
    totalAmount += amt;
    totalCost += cost;

    const sName = one(e.work_streams)?.name ?? "—";
    const rName = one(e.resources)?.name ?? "—";
    if (!streams.has(sName)) streams.set(sName, { hours: 0, amount: 0, cost: 0, res: new Map() });
    const s = streams.get(sName)!;
    s.hours += h;
    s.amount += amt;
    s.cost += cost;
    if (!s.res.has(rName)) s.res.set(rName, { hours: 0, amount: 0, cost: 0 });
    const r = s.res.get(rName)!;
    r.hours += h;
    r.amount += amt;
    r.cost += cost;
  }

  const groups: InvoiceGroup[] = [...streams.entries()]
    .map(([stream, s]) => ({
      stream,
      hours: s.hours,
      amount: s.amount,
      cost: s.cost,
      resources: [...s.res.entries()]
        .map(([name, r]) => ({
          name,
          hours: r.hours,
          amount: r.amount,
          rate: r.hours > 0 ? r.amount / r.hours : 0,
        }))
        .sort((a, b) => b.hours - a.hours),
    }))
    .sort((a, b) => b.hours - a.hours);

  return { groups, totalHours, totalAmount, totalCost };
}

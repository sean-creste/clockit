import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientsAdmin } from "./clients-admin";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: resource } = await admin
    .from("resources")
    .select("id, name, role")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!resource) redirect("/");
  if (resource.role !== "admin") redirect("/time");

  const [{ data: clients }, { data: streams }, { data: te }, { data: pos }, { data: docs }] =
    await Promise.all([
      admin
        .from("clients")
        .select("id, name, currency, engagement, payment_terms_days, billing_email, retainer_amount, active")
        .order("name"),
      admin
        .from("work_streams")
        .select("id, client_id, name, slug, budget_hours, budget_amount, active")
        .order("name"),
      admin.from("time_entries").select("work_stream_id, hours, po_id, bill_rate"),
      admin
        .from("purchase_orders")
        .select("id, client_id, po_number, description, amount, currency, status, issue_date, expiry_date")
        .order("created_at", { ascending: false }),
      admin
        .from("po_documents")
        .select("id, po_id, name, path, size_bytes")
        .order("created_at", { ascending: true }),
    ]);

  const logged = new Map<string, number>();
  const billedByPo = new Map<string, number>();
  for (const t of te ?? []) {
    logged.set(
      t.work_stream_id as string,
      (logged.get(t.work_stream_id as string) ?? 0) + Number(t.hours),
    );
    if (t.po_id) {
      billedByPo.set(
        t.po_id as string,
        (billedByPo.get(t.po_id as string) ?? 0) + Number(t.hours) * Number(t.bill_rate),
      );
    }
  }

  const data = (clients ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    currency: (c.currency as string) ?? "USD",
    engagement: (c.engagement as string) ?? "hourly",
    paymentTermsDays: (c.payment_terms_days as number) ?? 30,
    billingEmail: (c.billing_email as string) ?? "",
    retainerAmount: c.retainer_amount as number | null,
    active: Boolean(c.active),
    streams: (streams ?? [])
      .filter((s) => s.client_id === c.id)
      .map((s) => ({
        id: s.id as string,
        name: s.name as string,
        slug: (s.slug as string) ?? "",
        budgetHours: s.budget_hours as number | null,
        budgetAmount: s.budget_amount as number | null,
        active: Boolean(s.active),
        logged: logged.get(s.id as string) ?? 0,
      })),
    pos: (pos ?? [])
      .filter((p) => p.client_id === c.id)
      .map((p) => ({
        id: p.id as string,
        poNumber: p.po_number as string,
        description: (p.description as string) ?? "",
        amount: p.amount as number | null,
        currency: (p.currency as string) ?? ((c.currency as string) ?? "USD"),
        status: p.status as string,
        issueDate: p.issue_date as string | null,
        expiryDate: p.expiry_date as string | null,
        billed: billedByPo.get(p.id as string) ?? 0,
        documents: (docs ?? [])
          .filter((d) => d.po_id === p.id)
          .map((d) => ({
            id: d.id as string,
            name: d.name as string,
            path: d.path as string,
            sizeBytes: d.size_bytes as number | null,
          })),
      })),
  }));

  return (
    <AppShell active="clients" section="clients" userName={resource.name} role="admin">
      <ClientsAdmin clients={data} />
    </AppShell>
  );
}

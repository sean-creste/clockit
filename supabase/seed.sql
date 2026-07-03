-- Creste "clockit" — seed data (idempotent; safe to re-run).
-- Two founding partners as admin resources, one demo client with two work streams.

-- ── Founding partners (admins) ───────────────────────────────────────────────
-- email is unique -> on conflict do nothing. Emails double as the auth-linking key.
-- NOTE: partner@creste.dev is a placeholder — replace with the real second founder.
insert into resources (email, role, name, title, cost_rate, default_bill_rate)
values
  ('sean@creste.dev',    'admin',  'Sean Dahan',           'Founding Partner', 150.00, 150.00),
  ('partner@creste.dev', 'admin',  'Founding Partner Two', 'Founding Partner', 150.00, 250.00),
  -- One member resource so member-scoped RLS can be exercised (placeholder).
  ('dev@creste.dev',     'member', 'Alex Member',          'Engineer',         100.00, 175.00)
on conflict (email) do nothing;

-- ── Demo client ──────────────────────────────────────────────────────────────
insert into clients (name, legal_name, currency, engagement, billing_email)
select 'Acme Studio', 'Acme Studio, LLC', 'USD', 'hourly', 'billing@acme.example'
where not exists (select 1 from clients where name = 'Acme Studio');

-- ── Two work streams under the demo client ───────────────────────────────────
insert into work_streams (client_id, name)
select c.id, s.name
from clients c
cross join (values ('Dashboard UI'), ('ETL')) as s(name)
where c.name = 'Acme Studio'
  and not exists (
    select 1 from work_streams ws
    where ws.client_id = c.id and ws.name = s.name
  );

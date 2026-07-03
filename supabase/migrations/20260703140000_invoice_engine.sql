-- Invoice engine (ARCHITECTURE.md §4). Pure SQL, transactional. Generates one
-- invoice per active client for the month prior to p_period, stamping the
-- billed entries' invoice_id so they can never be re-billed (idempotency guard).
--
-- SECURITY: security definer (bypasses RLS to read cost/rates and write
-- invoices). Execute is revoked from client roles — only callable server-side
-- via the service role (see app/invoices/actions.ts, which gates on admin).

create or replace function public.generate_monthly_invoices(p_period date default null)
returns setof invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start  date := date_trunc('month', coalesce(p_period, current_date) - interval '1 month');
  v_end    date := (date_trunc('month', coalesce(p_period, current_date)) - interval '1 day');
  v_client clients%rowtype;
  v_inv    invoices%rowtype;
  v_num    text;
  v_seq    int;
  v_sum    numeric(12,2);
begin
  for v_client in select * from clients where active loop

    if not exists (
      select 1 from time_entries te
      join work_streams ws on ws.id = te.work_stream_id
      where ws.client_id = v_client.id
        and te.invoice_id is null and te.billable
        and te.entry_date between v_start and v_end
    ) then continue; end if;

    select coalesce(max(split_part(invoice_number,'-',3)::int),0)+1
      into v_seq from invoices
      where invoice_number like 'CRESTE-'||to_char(v_start,'YYYY')||'-%';
    v_num := 'CRESTE-'||to_char(v_start,'YYYY')||'-'||lpad(v_seq::text,3,'0');

    select coalesce(sum(te.hours * te.bill_rate),0) into v_sum
      from time_entries te
      join work_streams ws on ws.id = te.work_stream_id
      where ws.client_id = v_client.id
        and te.invoice_id is null and te.billable
        and te.entry_date between v_start and v_end;

    if v_client.engagement = 'retainer'   then v_sum := v_client.retainer_amount;
    elsif v_client.engagement = 'fixed_fee' then v_sum := v_client.fixed_fee_amount;
    elsif v_client.engagement = 'equity'    then v_sum := 0;
    end if;

    insert into invoices (client_id, invoice_number, period_start, period_end,
      issue_date, due_date, currency, subtotal, total, status)
    values (v_client.id, v_num, v_start, v_end,
      current_date, current_date + (v_client.payment_terms_days || ' days')::interval,
      v_client.currency, v_sum, v_sum, 'issued')
    returning * into v_inv;

    update time_entries te set invoice_id = v_inv.id
      from work_streams ws
      where ws.id = te.work_stream_id and ws.client_id = v_client.id
        and te.invoice_id is null and te.billable
        and te.entry_date between v_start and v_end;

    return next v_inv;
  end loop;
end $$;

revoke all on function public.generate_monthly_invoices(date) from public, anon, authenticated;
grant execute on function public.generate_monthly_invoices(date) to service_role;

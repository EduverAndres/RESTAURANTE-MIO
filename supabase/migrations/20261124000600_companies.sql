-- Corporate accounts: a company buys food for its employees on credit.
--
-- A company signs up (pending), the Cerquita team approves it with a credit
-- line, payment terms and a tip cap, and its admins invite employees by link,
-- each with an optional monthly budget and per-order cap. An employee pays an
-- order with "Cuenta de empresa"; `authorize_corporate_payment` (0800) checks
-- every limit under a lock on the company and marks the order paid. Once a
-- month `generate_company_statements` (0800) bills the delivered orders on one
-- statement, due after the payment terms; a statement past due blocks new
-- charges until it is paid.
--
-- This migration is the schema and the read rules:
--   * `nit_check_digit()` (DIAN) and `bogota_month_start()`;
--   * companies, members, invitations (token stored as its SHA-256),
--     statements and their lines, and the billing snapshot the merchant
--     invoices against (`order_corporate_billing`);
--   * four columns on orders, tied to the payment method by a check;
--   * `is_company_member/admin` for RLS, and the internal credit helpers;
--   * `protect_order_columns` recreated with the new columns;
--   * two new consent sources for the Términos para Empresas.
--
-- Nobody writes these tables through the API: user actions go through the
-- SECURITY DEFINER functions of 0700, money through the service-role ones of
-- 0800, and the admin panel through the service role.
--
-- Additive and reversible: supabase/rollbacks/20261124000600_companies.down.sql.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Pure helpers
-- ---------------------------------------------------------------------------
-- The DIAN check digit: weights 3, 7, 13, ... from the right; r = sum mod 11;
-- DV = r when r <= 1, else 11 - r. Mirror of lib/companies/nit.ts.
create or replace function public.nit_check_digit(p_nit text)
returns smallint
language plpgsql
immutable
set search_path = public
as $$
declare
  v_weights constant integer[] := array[
-- codegen:begin(nit_weights)
3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71
-- codegen:end(nit_weights)
  ];
  v_len integer;
  v_sum integer := 0;
  v_rest integer;
begin
  if p_nit is null or p_nit !~ '^[0-9]{1,15}$' then
    return null;
  end if;
  v_len := length(p_nit);
  for i in 1..v_len loop
    v_sum := v_sum + substr(p_nit, v_len - i + 1, 1)::integer * v_weights[i];
  end loop;
  v_rest := v_sum % 11;
  return (case when v_rest <= 1 then v_rest else 11 - v_rest end)::smallint;
end;
$$;

-- The current billing period: the first day of this month in Bogotá.
-- Mirror of `bogotaMonthStart` in lib/companies/period.ts.
create or replace function public.bogota_month_start()
returns date
language sql
stable
set search_path = public
as $$
  select date_trunc('month', now() at time zone 'America/Bogota')::date;
$$;

revoke all on function public.nit_check_digit(text) from public, anon;
grant execute on function public.nit_check_digit(text) to authenticated, service_role;
revoke all on function public.bogota_month_start() from public, anon;
grant execute on function public.bogota_month_start() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Companies
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null
    check (char_length(legal_name) between 2 and 160),
  trade_name text
    check (trade_name is null or char_length(trade_name) between 2 and 80),
  nit text not null
    check (nit ~ '^[0-9]{6,15}$'),
  dv smallint not null,
  billing_email text not null
    check (char_length(billing_email) <= 160 and billing_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  billing_address text not null
    check (char_length(billing_address) between 5 and 200),
  city text not null default 'Barranquilla'
    check (char_length(city) between 2 and 80),
  contact_name text not null
    check (char_length(contact_name) between 2 and 80),
  contact_phone text not null
    check (contact_phone ~ '^\+?[0-9]{7,15}$'),
  status text not null default 'pending'
    constraint companies_status_check check (status in (
-- codegen:begin(company_statuses)
'pending', 'active', 'suspended'
-- codegen:end(company_statuses)
    )),
  credit_limit numeric(14, 2) not null default 0
    check (credit_limit >= 0),
  payment_terms_days smallint not null default 30
    check (payment_terms_days between 0 and 90),
  max_tip_pct smallint not null default 10
    check (max_tip_pct between 0 and 30),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  suspended_at timestamptz,
  status_note text
    check (status_note is null or char_length(status_note) <= 300),
  terms_version text not null
    check (char_length(terms_version) between 1 and 40),
  terms_accepted_by uuid references public.profiles (id) on delete set null,
  terms_accepted_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_dv_check check (dv = public.nit_check_digit(nit)),
  constraint companies_approved_shape
    check (status = 'pending' or approved_at is not null),
  constraint companies_suspended_shape
    check ((status = 'suspended') = (suspended_at is not null))
);

create unique index companies_nit_key on public.companies (nit);

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

comment on table public.companies is
  'Corporate accounts. Signed up by a user (register_company), approved with a credit line by an admin; never written through the API.';

-- ---------------------------------------------------------------------------
-- 3. Invitations (before members, which point at the one they used)
-- ---------------------------------------------------------------------------
create table public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- SHA-256 of the token in the link, hex. The token itself is never stored.
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  role text not null default 'member'
    constraint company_invitations_role_check check (role in (
-- codegen:begin(invitation_roles)
'admin', 'member'
-- codegen:end(invitation_roles)
    )),
  monthly_budget numeric(14, 2)
    check (monthly_budget is null or monthly_budget > 0),
  per_order_limit numeric(14, 2)
    check (per_order_limit is null or per_order_limit > 0),
  max_uses smallint not null default 1
    check (max_uses between 1 and
-- codegen:begin(invitation_max_uses)
200
-- codegen:end(invitation_max_uses)
    ),
  uses smallint not null default 0,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint company_invitations_uses check (uses between 0 and max_uses),
  constraint company_invitations_window check (
    expires_at > created_at
    and expires_at <= created_at + make_interval(days =>
-- codegen:begin(invitation_max_days)
30
-- codegen:end(invitation_max_days)
    )
  )
);

create index company_invitations_company_idx
  on public.company_invitations (company_id, created_at desc);

comment on table public.company_invitations is
  'Join links of a company. Only the SHA-256 of each token is kept; created and revoked by company admins through RPCs.';

-- ---------------------------------------------------------------------------
-- 4. Members
-- ---------------------------------------------------------------------------
create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member'
    constraint company_members_role_check check (role in (
-- codegen:begin(company_member_roles)
'admin', 'member'
-- codegen:end(company_member_roles)
    )),
  -- Null: no personal monthly budget (the company's credit line still applies).
  monthly_budget numeric(14, 2)
    check (monthly_budget is null or monthly_budget > 0),
  per_order_limit numeric(14, 2)
    check (per_order_limit is null or per_order_limit > 0),
  active boolean not null default true,
  invitation_id uuid references public.company_invitations (id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  constraint company_members_left_shape check (active = (left_at is null))
);

-- One company at a time per person: whose budget an order spends is never
-- ambiguous. A member who leaves keeps their row (history) and may join again.
create unique index company_members_one_active
  on public.company_members (user_id)
  where active;

create index company_members_company_idx
  on public.company_members (company_id)
  where active;

comment on table public.company_members is
  'Who may charge a company, with their monthly budget and per-order cap. Changed by company admins through set_company_member.';

-- ---------------------------------------------------------------------------
-- 5. Orders paid with a company account
-- ---------------------------------------------------------------------------
alter table public.orders
  add column company_id uuid references public.companies (id) on delete restrict,
  add column company_member_id uuid references public.company_members (id) on delete set null,
  -- The billing month the charge belongs to, stamped when it is authorised.
  add column corporate_period date
    check (corporate_period is null or corporate_period = date_trunc('month', corporate_period)::date),
  -- "Motivo o centro de costo", typed by the employee at checkout.
  add column corporate_reference text
    check (corporate_reference is null or char_length(corporate_reference) <= 80);

-- `not valid` first so adding it does not scan the table under the
-- ACCESS EXCLUSIVE lock; `validate` then checks existing rows under a lock
-- that lets reads and writes go on.
alter table public.orders
  add constraint orders_corporate_company
  check ((payment_method = 'corporate') = (company_id is not null))
  not valid;
alter table public.orders validate constraint orders_corporate_company;

create index orders_company_period_idx
  on public.orders (company_id, corporate_period)
  where company_id is not null;

create index orders_company_member_period_idx
  on public.orders (company_member_id, corporate_period)
  where company_member_id is not null;

-- What the merchant invoices against: the company's legal name, NIT and
-- billing contact as they were when the order was authorised, so a later
-- change of address never rewrites an invoice already issued. `store_id` is
-- copied from the order so RLS can let the store owner read it.
create table public.order_corporate_billing (
  order_id uuid primary key references public.orders (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  store_id uuid not null references public.stores (id) on delete cascade,
  legal_name text not null,
  nit text not null,
  dv smallint not null,
  billing_email text not null,
  billing_address text not null,
  city text not null,
  -- The merchant's own invoice number, once they issued it.
  merchant_invoice_ref text
    check (merchant_invoice_ref is null or char_length(merchant_invoice_ref) between 1 and 60),
  invoiced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint order_corporate_billing_invoice_shape
    check ((merchant_invoice_ref is null) = (invoiced_at is null))
);

create index order_corporate_billing_store_idx
  on public.order_corporate_billing (store_id, created_at desc);

create index order_corporate_billing_company_idx
  on public.order_corporate_billing (company_id);

comment on table public.order_corporate_billing is
  'Billing snapshot of a corporate order for the merchant''s invoice (legal name, NIT, contact). Written by authorize_corporate_payment.';

-- ---------------------------------------------------------------------------
-- 6. Monthly statements
-- ---------------------------------------------------------------------------
create table public.company_statements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  period date not null
    check (period = date_trunc('month', period)::date),
  legal_name text not null,
  nit text not null,
  dv smallint not null,
  issued_on date not null,
  due_on date not null,
  total numeric(14, 2) not null,
  status text not null default 'issued'
    constraint company_statements_status_check check (status in (
-- codegen:begin(statement_statuses)
'issued', 'overdue', 'paid', 'void'
-- codegen:end(statement_statuses)
    )),
  paid_at timestamptz,
  payment_ref text
    check (payment_ref is null or char_length(payment_ref) <= 80),
  voided_at timestamptz,
  void_reason text
    check (void_reason is null or char_length(void_reason) between 3 and 200),
  created_at timestamptz not null default now(),
  constraint company_statements_due check (due_on >= issued_on),
  constraint company_statements_paid_shape
    check ((status = 'paid') = (paid_at is not null)),
  constraint company_statements_void_shape
    check ((status = 'void') = (voided_at is not null)
      and (voided_at is null) = (void_reason is null))
);

-- One live statement per company and month; a voided one can be reissued.
create unique index company_statements_one_per_period
  on public.company_statements (company_id, period)
  where status <> 'void';

create index company_statements_open_idx
  on public.company_statements (company_id)
  where status in (
-- codegen:begin(open_statements_index)
'issued', 'overdue'
-- codegen:end(open_statements_index)
  );

comment on table public.company_statements is
  'One statement per company and billing month, due payment_terms_days after it is issued. Written by generate_company_statements; marked paid by an admin.';

create table public.company_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.company_statements (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  kind text not null
    constraint company_statement_lines_kind_check check (kind in (
-- codegen:begin(statement_line_kinds)
'charge', 'refund'
-- codegen:end(statement_line_kinds)
    )),
  amount numeric(14, 2) not null,
  -- Copied for the printed statement: what, where, who and why.
  short_code text not null,
  store_name text not null,
  member_name text,
  corporate_reference text,
  ordered_at timestamptz not null,
  -- Set when the statement is voided, which frees the order to be billed again.
  voided boolean not null default false,
  created_at timestamptz not null default now(),
  constraint company_statement_lines_sign
    check ((kind = 'charge' and amount >= 0) or (kind = 'refund' and amount <= 0))
);

-- An order is charged once and credited once, across every live statement.
create unique index company_statement_lines_once
  on public.company_statement_lines (order_id, kind)
  where not voided;

create index company_statement_lines_statement_idx
  on public.company_statement_lines (statement_id);

comment on table public.company_statement_lines is
  'Lines of a statement: a charge per delivered order, a negative refund line per refund (abono). Unique per order and kind among live lines.';

-- ---------------------------------------------------------------------------
-- 7. Helpers
-- ---------------------------------------------------------------------------
-- RLS predicates. Security definer so policies on company_members can ask
-- about company_members without recursing into their own policies.
create or replace function public.is_company_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.active
  );
$$;

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.active
      and m.role = 'admin'
  );
$$;

revoke all on function public.is_company_member(uuid) from public, anon;
grant execute on function public.is_company_member(uuid) to authenticated;
revoke all on function public.is_company_admin(uuid) from public, anon;
grant execute on function public.is_company_admin(uuid) to authenticated;

-- Credit in use. Mirror of `creditUsed` in lib/companies/budget.ts:
-- authorised orders no statement has charged yet, plus statements not paid,
-- minus refunds of charged orders no statement has credited yet.
create or replace function public.company_credit_used(p_company_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((
      select sum(o.total)
      from public.orders o
      where o.company_id = p_company_id
        and
-- codegen:begin(holds_credit_unbilled)
o.payment_method = 'corporate' and o.payment_status = 'paid' and o.status <> 'cancelled'
-- codegen:end(holds_credit_unbilled)
        and not exists (
          select 1 from public.company_statement_lines l
          where l.order_id = o.id and l.kind = 'charge' and not l.voided
        )
    ), 0)
    + coalesce((
      select sum(s.total)
      from public.company_statements s
      where s.company_id = p_company_id
        and
-- codegen:begin(statement_open_credit)
s.status in ('issued', 'overdue')
-- codegen:end(statement_open_credit)
    ), 0)
    - coalesce((
      select sum(r.amount)
      from public.refunds r
      join public.orders o on o.id = r.order_id
      where o.company_id = p_company_id
        and exists (
          select 1 from public.company_statement_lines l
          where l.order_id = o.id and l.kind = 'charge' and not l.voided
        )
        and not exists (
          select 1 from public.company_statement_lines l
          where l.order_id = o.id and l.kind = 'refund' and not l.voided
        )
    ), 0);
$$;

-- What a member has spent in a period. Mirror of `spent_this_month`.
create or replace function public.company_member_spent(p_member_id uuid, p_period date)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(o.total), 0)
  from public.orders o
  where o.company_member_id = p_member_id
    and o.corporate_period = p_period
    and
-- codegen:begin(holds_credit_spent)
o.payment_method = 'corporate' and o.payment_status = 'paid' and o.status <> 'cancelled'
-- codegen:end(holds_credit_spent)
  ;
$$;

-- In arrears: a statement with money due is past its due date in Bogotá.
-- Mirror of `isStatementOverdue`.
create or replace function public.company_is_overdue(p_company_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
begin
  return exists (
    select 1
    from public.company_statements s
    where s.company_id = p_company_id
      and
-- codegen:begin(statement_overdue)
s.status in ('issued', 'overdue') and s.total > 0 and s.due_on < v_today
-- codegen:end(statement_overdue)
  );
end;
$$;

revoke all on function public.company_credit_used(uuid) from public, anon, authenticated;
grant execute on function public.company_credit_used(uuid) to service_role;
revoke all on function public.company_member_spent(uuid, date) from public, anon, authenticated;
grant execute on function public.company_member_spent(uuid, date) to service_role;
revoke all on function public.company_is_overdue(uuid) from public, anon, authenticated;
grant execute on function public.company_is_overdue(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Read rules. No insert, update or delete policy for the API on purpose.
-- ---------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.company_invitations enable row level security;
alter table public.company_members enable row level security;
alter table public.order_corporate_billing enable row level security;
alter table public.company_statements enable row level security;
alter table public.company_statement_lines enable row level security;

create policy "companies: member read"
  on public.companies for select to authenticated
  using (public.is_company_member(id));

create policy "companies: admin full access"
  on public.companies for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "company_invitations: company admin read"
  on public.company_invitations for select to authenticated
  using (public.is_company_admin(company_id));

create policy "company_invitations: admin full access"
  on public.company_invitations for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "company_members: read own"
  on public.company_members for select to authenticated
  using (user_id = auth.uid());

create policy "company_members: company admin read"
  on public.company_members for select to authenticated
  using (public.is_company_admin(company_id));

create policy "company_members: admin full access"
  on public.company_members for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "order_corporate_billing: store owner read"
  on public.order_corporate_billing for select to authenticated
  using (public.owns_store(store_id));

create policy "order_corporate_billing: company admin read"
  on public.order_corporate_billing for select to authenticated
  using (public.is_company_admin(company_id));

create policy "order_corporate_billing: admin full access"
  on public.order_corporate_billing for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "company_statements: company admin read"
  on public.company_statements for select to authenticated
  using (public.is_company_admin(company_id));

create policy "company_statements: admin full access"
  on public.company_statements for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "company_statement_lines: company admin read"
  on public.company_statement_lines for select to authenticated
  using (public.is_company_admin(company_id));

create policy "company_statement_lines: admin full access"
  on public.company_statement_lines for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.companies from anon, authenticated;
revoke all on public.company_invitations from anon, authenticated;
revoke all on public.company_members from anon, authenticated;
revoke all on public.order_corporate_billing from anon, authenticated;
revoke all on public.company_statements from anon, authenticated;
revoke all on public.company_statement_lines from anon, authenticated;
grant select on public.companies to authenticated;
grant select on public.company_invitations to authenticated;
grant select on public.company_members to authenticated;
grant select on public.order_corporate_billing to authenticated;
grant select on public.company_statements to authenticated;
grant select on public.company_statement_lines to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Who an order is charged to is server-only too
-- ---------------------------------------------------------------------------
-- Same function as 20261119000100_lock_order_writes.sql, plus the four
-- corporate columns: a customer must not move their order onto a company,
-- change the budget it spends or the period it is billed in.
create or replace function public.protect_order_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  if new.store_id is distinct from old.store_id
     or new.customer_id is distinct from old.customer_id
     or new.address_id is distinct from old.address_id
     or new.type is distinct from old.type
     or new.table_number is distinct from old.table_number
     or new.short_code is distinct from old.short_code
     or new.subtotal is distinct from old.subtotal
     or new.delivery_fee is distinct from old.delivery_fee
     or new.platform_fee is distinct from old.platform_fee
     or new.tip is distinct from old.tip
     or new.total is distinct from old.total
     or new.payment_method is distinct from old.payment_method
     or new.payment_status is distinct from old.payment_status
     or new.payment_ref is distinct from old.payment_ref
     or new.merchant_discount is distinct from old.merchant_discount
     or new.platform_discount is distinct from old.platform_discount
     or new.coupon_id is distinct from old.coupon_id
     or new.loyalty_redeemed is distinct from old.loyalty_redeemed
     or new.credit_id is distinct from old.credit_id
     or new.company_id is distinct from old.company_id
     or new.company_member_id is distinct from old.company_member_id
     or new.corporate_period is distinct from old.corporate_period
     or new.corporate_reference is distinct from old.corporate_reference
     or new.created_at is distinct from old.created_at then
    raise exception 'Only the server can change the price, payment or ownership of an order'
      using errcode = 'insufficient_privilege';
  end if;

  -- The courier column only ever goes from empty to the caller: a courier
  -- claiming the order. Nobody hands an order to someone else this way.
  if new.courier_id is distinct from old.courier_id
     and not (old.courier_id is null and new.courier_id = auth.uid()) then
    raise exception 'Only a courier can assign an order, and only to themselves'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 10. Proof of consent for the Términos para Empresas
-- ---------------------------------------------------------------------------
alter table public.legal_consents drop constraint legal_consents_source_check;
alter table public.legal_consents
  add constraint legal_consents_source_check check (source in (
-- codegen:begin(consent_sources)
'register', 'login-password', 'login-sms', 'login-google', 'login-microsoft', 'gate', 'company-register', 'company-join'
-- codegen:end(consent_sources)
  ));

reset lock_timeout;

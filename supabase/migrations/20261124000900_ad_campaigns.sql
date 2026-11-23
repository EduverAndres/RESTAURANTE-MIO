-- Paid placements: a store pays per day to appear first, labelled
-- "Patrocinado", on the home's "Destacados" rail, at the top of its category
-- or at the top of the search suggestions.
--
-- 1. `ad_placements` is the price list: one row per placement with its price
--    per day, how many campaigns fit on a day (`max_slots`, per category for
--    `category_top`) and the shortest and longest campaign. Anyone reads it;
--    an admin edits it through the server.
--
-- 2. `ad_campaigns` is a merchant's request for a run of Bogotá days, both
--    ends included, at the price of the day it was asked (`daily_price` is
--    frozen; `total_price` is computed from it). An admin approves it
--    (`approve_ad_campaign`, which holds the slot limit under a lock), or
--    rejects it with a reason; the merchant may cancel it while it waits. An
--    approved campaign can be paused, resumed and ended by an admin, and is
--    paused by itself when its store is suspended. `guard_ad_campaign_update`
--    allows only those moves (lib/ads/vocabulary.ts) and keeps the terms
--    immutable. Every pause is logged in `ad_campaign_pauses` by trigger, in
--    the same transaction as the status change, because the log is what the
--    settlement reads.
--
-- 3. Clicks go through /api/ads/click/<id> (`record_ad_click`, service role
--    only), which counts one per day in `ad_daily_stats` and redirects to
--    the store. `sponsored_stores(placement)` lists what is on the air now
--    for the pages that show it; it returns no prices and no ids beyond the
--    campaign's and the store's.
--
-- 4. The fee: `payouts.ads_fee` and generate_payouts v4 (same signature).
--    Each campaign is charged its price per day for the days of the period
--    it ran: a day is charged when the campaign starts or keeps running that
--    day; the day it is paused or ended is not, and paused days never are.
--
--      net = gross - commission - cash_collected - plan_fee - ads_fee
--            + delivery_and_tips + carried_in
--
-- Mirrored rules are emitted by lib/payouts/sql.ts and lib/ads/vocabulary.ts
-- and compared byte for byte by tests/payouts-sql-drift.test.ts and
-- tests/ads-vocabulary-drift.test.ts. Do not hand-edit the generated blocks:
-- change the rule in lib/, run the tests, paste the output.
--
-- Nobody writes these tables through the API: owners read their own
-- campaigns, admins read everything, and every write is the server's.
--
-- Additive and reversible: four tables, five functions, two triggers, one
-- column and a new body for generate_payouts.
-- supabase/rollbacks/20261124000900_ad_campaigns.down.sql undoes it.

set lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- 1. Price list
-- ---------------------------------------------------------------------------
create table public.ad_placements (
  placement text primary key
    constraint ad_placements_placement_check check (placement in (
-- codegen:begin(ad_placements)
'home_featured', 'category_top', 'search_top'
-- codegen:end(ad_placements)
    )),
  daily_price numeric not null
    constraint ad_placements_price_check check (daily_price > 0 and daily_price = round(daily_price)),
  max_slots smallint not null
    constraint ad_placements_slots_check check (max_slots between 1 and 20),
  min_days smallint not null
    constraint ad_placements_min_days_check check (min_days between 1 and 90),
  max_days smallint not null
    constraint ad_placements_max_days_check check (max_days between 1 and 90),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint ad_placements_days_order check (max_days >= min_days)
);

create trigger ad_placements_set_updated_at
  before update on public.ad_placements
  for each row execute function public.set_updated_at();

comment on table public.ad_placements is
  'Price per day and slots of each sponsored placement. Read by anyone; edited by an admin through the server.';

-- Opening prices. lib/ads/pricing.ts (DEFAULT_AD_PLACEMENTS) mirrors them.
insert into public.ad_placements (placement, daily_price, max_slots, min_days, max_days)
values
  ('home_featured', 15000, 3, 3, 30),
  ('category_top', 8000, 2, 3, 30),
  ('search_top', 6000, 2, 3, 30);

alter table public.ad_placements enable row level security;

create policy "ad_placements: public read"
  on public.ad_placements for select to anon, authenticated
  using (true);

revoke all on public.ad_placements from anon, authenticated;
grant select on public.ad_placements to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Campaigns
-- ---------------------------------------------------------------------------
create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  placement text not null references public.ad_placements (placement),
  -- Bogotá calendar dates, both included.
  starts_on date not null,
  ends_on date not null,
  -- The price per day when the merchant asked; a later price change never
  -- reaches a campaign already requested.
  daily_price numeric not null
    constraint ad_campaigns_price_check check (daily_price > 0),
  -- The quote. The settlement charges the days that ran, never more.
  total_price numeric generated always as (daily_price * (ends_on - starts_on + 1)) stored,
  status text not null default 'requested'
    constraint ad_campaigns_status_check check (status in (
-- codegen:begin(ad_statuses)
'requested', 'active', 'paused', 'ended', 'rejected', 'cancelled'
-- codegen:end(ad_statuses)
    )),
  -- The store's category when it asked: the category page a category_top
  -- campaign is shown on, and the pool its slot is counted in.
  category_snapshot text
    constraint ad_campaigns_category_check check (category_snapshot is null or char_length(category_snapshot) between 1 and 60),
  pause_reason text
    constraint ad_campaigns_pause_reason_check check (pause_reason is null or pause_reason in (
-- codegen:begin(ad_pause_reasons_campaign)
'admin', 'store_suspended'
-- codegen:end(ad_pause_reasons_campaign)
    )),
  requested_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  rejection_reason text
    constraint ad_campaigns_rejection_check check (rejection_reason is null or char_length(rejection_reason) between 3 and 300),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_dates check (ends_on >= starts_on),
  constraint ad_campaigns_category_top_needs_category
    check (placement <> 'category_top' or category_snapshot is not null),
  constraint ad_campaigns_rejected_has_reason
    check (status <> 'rejected' or rejection_reason is not null),
  constraint ad_campaigns_approved_shape
    check (status in ('requested', 'rejected', 'cancelled') or approved_at is not null),
  constraint ad_campaigns_ended_shape
    check (status <> 'ended' or ended_at is not null),
  constraint ad_campaigns_paused_shape
    check ((status = 'paused') = (pause_reason is not null))
);

-- What is on the air (sponsored_stores), the approval count and the fee.
create index ad_campaigns_placement_dates_idx
  on public.ad_campaigns (placement, starts_on, ends_on)
  where status in ('active', 'paused');

create index ad_campaigns_store_idx
  on public.ad_campaigns (store_id, created_at desc);

create index ad_campaigns_requested_idx
  on public.ad_campaigns (created_at)
  where status = 'requested';

comment on table public.ad_campaigns is
  'Sponsored placements bought per day. Requested by the merchant and moved through statuses by the server only; charged in generate_payouts.';

alter table public.ad_campaigns enable row level security;

create policy "ad_campaigns: owner read"
  on public.ad_campaigns for select to authenticated
  using (public.owns_store(store_id));

create policy "ad_campaigns: admin read"
  on public.ad_campaigns for select to authenticated
  using (public.is_admin());

revoke all on public.ad_campaigns from anon, authenticated;
grant select on public.ad_campaigns to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pauses: the log the settlement reads
-- ---------------------------------------------------------------------------
create table public.ad_campaign_pauses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  reason text not null
    constraint ad_campaign_pauses_reason_check check (reason in (
-- codegen:begin(ad_pause_reasons)
'admin', 'store_suspended'
-- codegen:end(ad_pause_reasons)
    )),
  paused_at timestamptz not null default now(),
  resumed_at timestamptz,
  constraint ad_campaign_pauses_order check (resumed_at is null or resumed_at >= paused_at)
);

-- One open pause per campaign, so pauses never overlap: the billable-days
-- rule (lib/payouts/sql.ts) subtracts them one by one.
create unique index ad_campaign_pauses_open_key
  on public.ad_campaign_pauses (campaign_id)
  where resumed_at is null;

create index ad_campaign_pauses_campaign_idx
  on public.ad_campaign_pauses (campaign_id, paused_at);

comment on table public.ad_campaign_pauses is
  'Every pause of a campaign, written by trigger with the status change. Paused days are not charged.';

alter table public.ad_campaign_pauses enable row level security;

create policy "ad_campaign_pauses: owner read"
  on public.ad_campaign_pauses for select to authenticated
  using (exists (
    select 1 from public.ad_campaigns c
    where c.id = campaign_id and public.owns_store(c.store_id)
  ));

create policy "ad_campaign_pauses: admin read"
  on public.ad_campaign_pauses for select to authenticated
  using (public.is_admin());

revoke all on public.ad_campaign_pauses from anon, authenticated;
grant select on public.ad_campaign_pauses to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Clicks per day
-- ---------------------------------------------------------------------------
create table public.ad_daily_stats (
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  day date not null,
  clicks integer not null default 0
    constraint ad_daily_stats_clicks_check check (clicks >= 0),
  primary key (campaign_id, day)
);

comment on table public.ad_daily_stats is
  'Clicks on a sponsored placement per Bogotá day, counted by record_ad_click. Informative: the fee is per day, not per click.';

alter table public.ad_daily_stats enable row level security;

create policy "ad_daily_stats: owner read"
  on public.ad_daily_stats for select to authenticated
  using (exists (
    select 1 from public.ad_campaigns c
    where c.id = campaign_id and public.owns_store(c.store_id)
  ));

create policy "ad_daily_stats: admin read"
  on public.ad_daily_stats for select to authenticated
  using (public.is_admin());

revoke all on public.ad_daily_stats from anon, authenticated;
grant select on public.ad_daily_stats to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Status changes
-- ---------------------------------------------------------------------------
create or replace function public.guard_ad_campaign_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.store_id <> old.store_id
    or new.placement <> old.placement
    or new.daily_price <> old.daily_price
    or new.category_snapshot is distinct from old.category_snapshot
    or new.requested_by is distinct from old.requested_by
    or new.created_at <> old.created_at
  then
    raise exception 'a campaign''s terms cannot change'
      using errcode = 'check_violation';
  end if;

  -- The dates are the merchant's request until it is approved; the approval
  -- itself may move the start to the day it happens.
  if (new.starts_on <> old.starts_on or new.ends_on <> old.ends_on)
    and old.status <> 'requested'
  then
    raise exception 'an approved campaign''s dates cannot change'
      using errcode = 'check_violation';
  end if;

  if new.status <> old.status then
    if (old.status, new.status) not in (
-- codegen:begin(ad_transitions)
('requested', 'active'), ('requested', 'rejected'), ('requested', 'cancelled'), ('active', 'paused'), ('paused', 'active'), ('active', 'ended'), ('paused', 'ended')
-- codegen:end(ad_transitions)
    ) then
      raise exception 'campaign cannot go from % to %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    case new.status
      when 'active' then
        if old.status = 'requested' then
          new.approved_at := coalesce(new.approved_at, now());
        end if;
        new.pause_reason := null;
      when 'paused' then
        new.pause_reason := coalesce(new.pause_reason, 'admin');
      when 'ended' then
        new.ended_at := coalesce(new.ended_at, now());
        new.pause_reason := null;
      else null;
    end case;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger ad_campaigns_guard_update
  before update on public.ad_campaigns
  for each row execute function public.guard_ad_campaign_update();

-- Opens a pause when a campaign is paused and closes it when it leaves the
-- pause (resumed or ended), in the same transaction as the status change.
create or replace function public.log_ad_campaign_pause()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'paused' and old.status <> 'paused' then
    insert into public.ad_campaign_pauses (campaign_id, reason)
    values (new.id, new.pause_reason);
  elsif old.status = 'paused' and new.status <> 'paused' then
    update public.ad_campaign_pauses
      set resumed_at = now()
    where campaign_id = new.id
      and resumed_at is null;
  end if;
  return null;
end;
$$;

create trigger ad_campaigns_log_pause
  after update of status on public.ad_campaigns
  for each row execute function public.log_ad_campaign_pause();

revoke all on function public.guard_ad_campaign_update() from public, anon, authenticated;
revoke all on function public.log_ad_campaign_pause() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Approval, under the slot limit
-- ---------------------------------------------------------------------------
create or replace function public.approve_ad_campaign(p_id uuid, p_admin uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_placement text;
  v_slots integer;
  v_campaign public.ad_campaigns%rowtype;
  v_start date;
  v_peak integer;
begin
  select c.placement into v_placement
  from public.ad_campaigns c
  where c.id = p_id;
  if not found then
    return 'not_found';
  end if;

  -- Serialises every approval of this placement: two admins cannot both
  -- give away its last slot.
  select pl.max_slots into v_slots
  from public.ad_placements pl
  where pl.placement = v_placement
  for update;

  select * into v_campaign
  from public.ad_campaigns c
  where c.id = p_id
  for update;

  if v_campaign.status <> 'requested' then
    return 'not_requested';
  end if;

  if v_campaign.ends_on < v_today then
    return 'expired';
  end if;

  if not exists (
    select 1 from public.stores s
    where s.id = v_campaign.store_id and s.status = 'active'
  ) then
    return 'store_inactive';
  end if;

  -- Approved late, it starts today: the days that already went by were not
  -- on the air, so they are neither shown nor charged.
  v_start := greatest(v_campaign.starts_on, v_today);

  -- One campaign per store and placement at a time.
  if exists (
    select 1
    from public.ad_campaigns o
    where o.store_id = v_campaign.store_id
      and o.placement = v_campaign.placement
      and o.id <> v_campaign.id
      and o.status in (
-- codegen:begin(ad_holding_statuses_duplicate)
'active', 'paused'
-- codegen:end(ad_holding_statuses_duplicate)
      )
      and o.starts_on <= v_campaign.ends_on
      and o.ends_on >= v_start
  ) then
    return 'duplicate';
  end if;

  -- Mirror of `peakOccupancy` in lib/ads/capacity.ts: the busiest day of the
  -- campaign, counting the campaigns that share its slots.
  select coalesce(max(per_day.taken), 0) into v_peak
  from (
    select count(o.id) as taken
    from generate_series(v_start::timestamp, v_campaign.ends_on::timestamp, interval '1 day') as d(day)
    join public.ad_campaigns o
      on o.placement = v_campaign.placement
      and o.id <> v_campaign.id
      and o.status in (
-- codegen:begin(ad_holding_statuses_capacity)
'active', 'paused'
-- codegen:end(ad_holding_statuses_capacity)
      )
      and o.starts_on <= d.day::date
      and o.ends_on >= d.day::date
      and (
        v_campaign.placement <> 'category_top'
        or lower(o.category_snapshot) = lower(v_campaign.category_snapshot)
      )
    group by d.day
  ) per_day;

  if v_peak >= v_slots then
    return 'full';
  end if;

  update public.ad_campaigns
    set status = 'active',
        starts_on = v_start,
        approved_by = p_admin,
        approved_at = now()
  where id = p_id;

  return 'ok';
end;
$$;

revoke all on function public.approve_ad_campaign(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_ad_campaign(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. What is on the air, and its clicks
-- ---------------------------------------------------------------------------
-- Security definer because anon cannot read ad_campaigns; it returns only
-- what a sponsored card needs. The order rotates daily, so no campaign owns
-- the first position.
create or replace function public.sponsored_stores(p_placement text)
returns table (
  campaign_id uuid,
  store_id uuid,
  slug text,
  name text,
  category text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
begin
  return query
  select c.id, c.store_id, s.slug, s.name, c.category_snapshot
  from public.ad_campaigns c
  join public.stores s on s.id = c.store_id
  where c.placement = p_placement
    and s.status = 'active'
    and
-- codegen:begin(ad_running_sponsored)
c.status = 'active' and c.starts_on <= v_today and c.ends_on >= v_today
-- codegen:end(ad_running_sponsored)
  order by md5(c.id::text || v_today::text);
end;
$$;

revoke all on function public.sponsored_stores(text) from public, anon, authenticated;
grant execute on function public.sponsored_stores(text) to anon, authenticated, service_role;

-- Counts one click on a campaign that is on the air and returns the store's
-- slug to redirect to. A campaign that is not on the air (over, paused, a
-- stale link) still returns its slug, uncounted; an unknown id returns null.
create or replace function public.record_ad_click(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_slug text;
  v_running boolean;
begin
  select s.slug,
    (
-- codegen:begin(ad_running_click)
c.status = 'active' and c.starts_on <= v_today and c.ends_on >= v_today
-- codegen:end(ad_running_click)
    ) and s.status = 'active'
  into v_slug, v_running
  from public.ad_campaigns c
  join public.stores s on s.id = c.store_id
  where c.id = p_id;

  if v_slug is null then
    return null;
  end if;

  if v_running then
    insert into public.ad_daily_stats (campaign_id, day, clicks)
    values (p_id, v_today, 1)
    on conflict (campaign_id, day)
      do update set clicks = public.ad_daily_stats.clicks + 1;
  end if;

  return v_slug;
end;
$$;

revoke all on function public.record_ad_click(uuid) from public, anon, authenticated;
grant execute on function public.record_ad_click(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 8. The fee in the settlement
-- ---------------------------------------------------------------------------
alter table public.payouts
  add column ads_fee numeric not null default 0
    constraint payouts_ads_fee_not_negative check (ads_fee >= 0);

comment on column public.payouts.ads_fee is
  'Days of sponsored placement that ran in the period, at each campaign''s price per day. Subtracted from net.';

-- generate_payouts, v4: v3 (20261124000100_payout_carry.sql) plus the
-- `ads_fees` CTE and the column.
create or replace function public.generate_payouts(
  p_period_start date,
  p_period_end date
)
returns table (
  payouts_created integer,
  payouts_skipped integer,
  refunds_reversed integer,
  refunds_resolved integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Mirrors `periodEndExclusive` in `lib/payouts/compute.ts`, which builds
  -- `YYYY-MM-DDT00:00:00.000Z`. `at time zone 'UTC'` is load-bearing: a bare
  -- `::timestamptz` would be read in the session's time zone and shift every
  -- period boundary by the deployment's offset.
  v_from timestamptz := (p_period_start::timestamp at time zone 'UTC');
  v_to timestamptz := ((p_period_end + 1)::timestamp at time zone 'UTC');
begin
  perform pg_advisory_xact_lock(hashtext('public.generate_payouts'));

  -- Lock the debts this run may carry before the main statement takes its
  -- snapshot. A concurrent `markPayoutPaid` on one of them waits here, and
  -- once this transaction commits it finds the row carried and refuses.
  perform 1
  from public.payouts prev
  where
-- codegen:begin(carryable_lock)
prev.status = 'pending' and prev.net < 0 and prev.carried_into_payout_id is null and prev.period_end < p_period_start
-- codegen:end(carryable_lock)
  for update;

  return query
  with eligible as (
    -- Mirror of `isEligible` + the period window in `summarizePayouts`.
    select
      o.store_id,
      sum(
-- codegen:begin(settled_gross)
(o.subtotal - o.merchant_discount)
-- codegen:end(settled_gross)
      ) as gross,
      sum(o.platform_fee) as commission,
      sum(case when
-- codegen:begin(merchant_collected)
o.payment_method = 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(merchant_collected)
        then
-- codegen:begin(collected_amount)
(o.subtotal - o.merchant_discount - o.platform_discount)
-- codegen:end(collected_amount)
        else 0 end) as cash_collected,
      -- Mirror of `isPassedThroughToMerchant`: delivery fee and tip the
      -- platform collected for an order the merchant handed over.
      sum(case when
-- codegen:begin(merchant_passthrough)
o.payment_method <> 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(merchant_passthrough)
        then
-- codegen:begin(passthrough_amount)
(o.delivery_fee + o.tip)
-- codegen:end(passthrough_amount)
        else 0 end) as delivery_and_tips
    from public.orders o
    where
-- codegen:begin(eligible)
o.status = 'delivered'
    and o.payment_status <> 'refunded'
    and (o.payment_status = 'paid' or o.payment_method = 'cash')
-- codegen:end(eligible)
      and o.delivered_at >= v_from
      and o.delivered_at < v_to
    group by o.store_id
  ),
  pending as (
    -- Refunds no payout has carried yet. Mirror of `planReversals`: a refund
    -- recorded at or after this period's end is skipped entirely.
    select
      r.id as refund_id,
      r.store_id,
      -(
-- codegen:begin(reversal_settled_gross)
(o.subtotal - o.merchant_discount)
-- codegen:end(reversal_settled_gross)
      ) as adj_gross,
-- codegen:begin(reversal_commission)
-o.platform_fee
-- codegen:end(reversal_commission)
        as adj_commission,
      case when
-- codegen:begin(reversal_merchant_collected)
o.payment_method = 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(reversal_merchant_collected)
        then -(
-- codegen:begin(reversal_collected_amount)
(o.subtotal - o.merchant_discount - o.platform_discount)
-- codegen:end(reversal_collected_amount)
        ) else 0 end as adj_cash,
      -- The customer got the delivery fee and tip back too, so what was
      -- passed through to the merchant for that order is taken back.
      case when
-- codegen:begin(reversal_merchant_passthrough)
o.payment_method <> 'cash' and (o.type <> 'delivery' or o.courier_id is null)
-- codegen:end(reversal_merchant_passthrough)
        then -(
-- codegen:begin(reversal_passthrough_amount)
(o.delivery_fee + o.tip)
-- codegen:end(reversal_passthrough_amount)
        ) else 0 end as adj_passthrough,
      -- Mirror of `needsReversal`.
-- codegen:begin(reversal_needed)
exists (
      select 1
      from public.payouts settled
      where settled.store_id = r.store_id
        and o.delivered_at >= (settled.period_start::timestamp at time zone 'UTC')
        and o.delivered_at < ((settled.period_end + 1)::timestamp at time zone 'UTC')
        and settled.created_at <= r.issued_at
    )
-- codegen:end(reversal_needed)
        as needs_reversal
    from public.refunds r
    join public.orders o on o.id = r.order_id
    where r.reversed_in_payout_id is null
      and r.issued_at < v_to
  ),
  adjustments as (
    select
      p.store_id,
      sum(p.adj_gross) as gross,
      sum(p.adj_commission) as commission,
      sum(p.adj_cash) as cash_collected,
      sum(p.adj_passthrough) as delivery_and_tips
    from pending p
    where p.needs_reversal
    group by p.store_id
  ),
  plan_fees as (
    -- Mirror of `planFeeForPeriod`: the monthly fee, per billable day.
    select
      s.id as store_id,
      round(pl.monthly_fee * (
-- codegen:begin(billable_days)
greatest(0, p_period_end - greatest(p_period_start, coalesce(s.founder_until + 1, p_period_start)) + 1)
-- codegen:end(billable_days)
      ) / 30) as plan_fee
    from public.stores s
    join public.plans pl on pl.id = s.plan
    where s.status = 'active'
      and pl.monthly_fee > 0
  ),
  ads_fees as (
    -- Mirror of `adsFeesByStore` (lib/ads/billing.ts): each approved
    -- campaign's price per day, for the days of this period it ran. Not
    -- limited to active stores: a suspension pauses the campaigns, and the
    -- days before it still ran.
    select
      c.store_id,
      round(sum(c.daily_price * (
-- codegen:begin(ad_billable_days)
greatest(0, least(c.ends_on, coalesce((c.ended_at at time zone 'America/Bogota')::date - 1, c.ends_on), p_period_end) - greatest(c.starts_on, p_period_start) + 1)
      - coalesce((
        select sum(greatest(0, least(least(c.ends_on, coalesce((c.ended_at at time zone 'America/Bogota')::date - 1, c.ends_on), p_period_end), coalesce((pz.resumed_at at time zone 'America/Bogota')::date - 1, p_period_end)) - greatest(greatest(c.starts_on, p_period_start), (pz.paused_at at time zone 'America/Bogota')::date) + 1))
        from public.ad_campaign_pauses pz
        where pz.campaign_id = c.id
      ), 0)
-- codegen:end(ad_billable_days)
      ))) as ads_fee
    from public.ad_campaigns c
    where c.status in (
-- codegen:begin(ad_billed_statuses)
'active', 'paused', 'ended'
-- codegen:end(ad_billed_statuses)
    )
      -- Only an index-friendly shortcut: outside the period the rule above
      -- counts zero days anyway.
      and c.starts_on <= p_period_end
      and c.ends_on >= p_period_start
    group by c.store_id
  ),
  totals as (
    select
      u.store_id,
      sum(u.gross) as gross,
      sum(u.commission) as commission,
      sum(u.cash_collected) as cash_collected,
      sum(u.plan_fee) as plan_fee,
      sum(u.ads_fee) as ads_fee,
      sum(u.delivery_and_tips) as delivery_and_tips
    from (
      select e.store_id, e.gross, e.commission, e.cash_collected,
        0::numeric as plan_fee, 0::numeric as ads_fee, e.delivery_and_tips
      from eligible e
      union all
      select a.store_id, a.gross, a.commission, a.cash_collected,
        0::numeric, 0::numeric, a.delivery_and_tips
      from adjustments a
      union all
      select f.store_id, 0::numeric, 0::numeric, 0::numeric,
        f.plan_fee, 0::numeric, 0::numeric
      from plan_fees f
      where f.plan_fee > 0
      union all
      -- An ads fee alone produces a row, like a plan fee: the days ran.
      select af.store_id, 0::numeric, 0::numeric, 0::numeric,
        0::numeric, af.ads_fee, 0::numeric
      from ads_fees af
      where af.ads_fee > 0
    ) u
    group by u.store_id
  ),
  carry as (
    -- Mirror of `isCarryable`: open debts from periods that ended before
    -- this one starts.
    select prev.id, prev.store_id, prev.net
    from public.payouts prev
    where
-- codegen:begin(carryable)
prev.status = 'pending' and prev.net < 0 and prev.carried_into_payout_id is null and prev.period_end < p_period_start
-- codegen:end(carryable)
  ),
  carry_totals as (
    select c.store_id, sum(c.net) as carried_in
    from carry c
    group by c.store_id
  ),
  inserted as (
    insert into public.payouts (
      store_id, period_start, period_end, gross, commission, cash_collected,
      plan_fee, ads_fee, delivery_and_tips, carried_in, net
    )
    select
      t.store_id,
      p_period_start,
      p_period_end,
      t.gross,
      t.commission,
      t.cash_collected,
      t.plan_fee,
      t.ads_fee,
      t.delivery_and_tips,
      coalesce(ct.carried_in, 0),
-- codegen:begin(payout_net)
t.gross - t.commission - t.cash_collected - t.plan_fee - t.ads_fee + t.delivery_and_tips + coalesce(ct.carried_in, 0)
-- codegen:end(payout_net)
    -- Only stores with a row of their own this period: a carry alone never
    -- creates one (mirror of `summarizePayouts`).
    from totals t
    left join carry_totals ct on ct.store_id = t.store_id
    on conflict on constraint payouts_store_period_key do nothing
    returning id, store_id
  ),
  stamped as (
    update public.refunds r
      set reversed_in_payout_id = i.id
    from inserted i, pending p
    where p.refund_id = r.id
      and p.store_id = i.store_id
      and r.reversed_in_payout_id is null
    returning r.id
  ),
  carried as (
    -- Closes each carried debt. A store whose period already existed got no
    -- inserted row, so nothing of it is stamped and nothing is counted twice.
    update public.payouts prev
      set carried_into_payout_id = i.id
    from inserted i, carry c
    where prev.id = c.id
      and c.store_id = i.store_id
      and prev.carried_into_payout_id is null
      and prev.status = 'pending'
    returning prev.id
  )
  select
    (select count(*) from inserted)::integer,
    ((select count(*) from totals) - (select count(*) from inserted))::integer,
    (select count(*) from pending p where p.needs_reversal)::integer,
    -- `carried` is referenced so the stamp is visibly part of the result;
    -- PostgreSQL runs data-modifying CTEs to completion either way.
    ((select count(*) from stamped) + 0 * (select count(*) from carried))::integer;
end;
$$;

revoke all on function public.generate_payouts(date, date) from public, anon, authenticated;
grant execute on function public.generate_payouts(date, date) to service_role;

reset lock_timeout;

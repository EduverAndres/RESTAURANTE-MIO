-- Give orders.short_code a real column default so inserts never need to pass
-- it (and generated types mark it optional). The BEFORE INSERT trigger keeps
-- guarding explicit nulls.

create or replace function public.next_short_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := '';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.orders o where o.short_code = candidate);
  end loop;
  return candidate;
end;
$$;

alter table public.orders
  alter column short_code set default public.next_short_code();

create or replace function public.generate_short_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.short_code is null or new.short_code = '' then
    new.short_code := public.next_short_code();
  end if;
  return new;
end;
$$;

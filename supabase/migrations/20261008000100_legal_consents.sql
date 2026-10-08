-- Proof of consent.
--
-- Ley 1581 de 2012 and Decreto 1377 de 2013 (art. 8) require the controller
-- to keep proof that each person authorised the processing of their data,
-- and the platform needs the same proof for its Terms. The user's own auth
-- metadata already says which version they accepted — that is what the
-- middleware gate reads, because it is free on every request — but a user
-- can rewrite their own metadata, so it is not evidence.
--
-- This table is. It is append-only: one row per acceptance, written only by
-- the server through the service role, never updated, never deleted by the
-- application. A user can read their own history; nobody else can read it.

create table public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  -- Nullable and `set null`: when an account is deleted the evidence that
  -- it once consented must survive for the legal retention period.
  user_id uuid references auth.users (id) on delete set null,
  document_version text not null,
  source text not null
    check (source in ('register', 'login-password', 'login-sms', 'login-google', 'login-microsoft', 'gate')),
  marketing_opt_in boolean,
  ip inet,
  user_agent text,
  accepted_at timestamptz not null default now()
);

create index legal_consents_user_id_idx
  on public.legal_consents (user_id, accepted_at desc);

comment on table public.legal_consents is
  'Append-only proof of acceptance of the Terms and the data-processing policy '
  '(Ley 1581/2012, Decreto 1377/2013 art. 8). Written only by the service role.';

alter table public.legal_consents enable row level security;

-- Read your own history (e.g. for an access request). No insert, update or
-- delete policies on purpose: only the service role, which bypasses RLS,
-- writes here, so a client cannot forge or erase a record.
create policy "legal_consents: read own"
  on public.legal_consents for select to authenticated
  using (user_id = auth.uid());

revoke all on public.legal_consents from anon;
revoke insert, update, delete on public.legal_consents from authenticated;

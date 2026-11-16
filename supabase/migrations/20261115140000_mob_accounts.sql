begin;

alter table public.mob_settings
  add column if not exists daily_limit_minutes smallint not null default 0 check (daily_limit_minutes between 0 and 1440),
  add column if not exists blocked_sites text[] not null default '{}' check (cardinality(blocked_sites) <= 30),
  add column if not exists share_score boolean not null default false,
  add column if not exists timer_state jsonb check (timer_state is null or (jsonb_typeof(timer_state) = 'object' and octet_length(timer_state::text) <= 1024));
alter table public.mob_tasks add column if not exists remind_at timestamptz;

create table if not exists public.mob_handles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9-]{2,23}$')
);
alter table public.mob_handles enable row level security;
revoke all on public.mob_handles from public, anon, authenticated;
grant select, insert on public.mob_handles to authenticated;
drop policy if exists mob_handle_owner on public.mob_handles;
create policy mob_handle_owner on public.mob_handles for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
insert into public.mob_handles(user_id, username)
select distinct on (username) user_id, username
from public.mob_settings where username ~ '^[a-z0-9][a-z0-9-]{2,23}$'
order by username, user_id
on conflict do nothing;

-- A read-only projection, with no email, account ID, task or usage data in its results.
create schema if not exists mob_internal;
revoke all on schema mob_internal from public, anon, authenticated;
grant usage on schema mob_internal to authenticated;
create or replace function mob_internal.leaderboard()
returns table (username text, minutes bigint, "position" bigint)
language sql stable security definer set search_path = ''
as $$
  select h.username, sum(f.minutes), rank() over (order by sum(f.minutes) desc)
  from public.mob_handles h
  join public.mob_settings s using (user_id)
  join public.mob_focus_sessions f using (user_id)
  where (select auth.uid()) is not null and s.share_score
  group by h.username
  order by sum(f.minutes) desc, h.username
  limit 100;
$$;
revoke all on function mob_internal.leaderboard() from public, anon, authenticated;
grant execute on function mob_internal.leaderboard() to authenticated;

create or replace function public.mob_leaderboard()
returns table (username text, minutes bigint, "position" bigint)
language sql stable security invoker set search_path = ''
as $$ select * from mob_internal.leaderboard(); $$;
revoke all on function public.mob_leaderboard() from public, anon, authenticated;
grant execute on function public.mob_leaderboard() to authenticated;

create table if not exists mob_internal.login_attempts (
  bucket text primary key,
  started timestamptz not null,
  attempts integer not null
);
alter table mob_internal.login_attempts enable row level security;
grant usage on schema mob_internal to service_role;
grant select, insert, update, delete on mob_internal.login_attempts to service_role;
grant select on public.mob_handles to service_role;

-- Called only by the password proxy, so the email mapping never goes to an unauthenticated client.
create or replace function public.mob_login_email(p_username text, p_network text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  attempts_for_network integer;
  resolved_email text;
begin
  if current_setting('request.jwt.claims', true)::jsonb ->> 'role' is distinct from 'service_role' then
    raise insufficient_privilege;
  end if;
  if p_username !~ '^[a-z0-9][a-z0-9-]{2,23}$' then return null; end if;
  delete from mob_internal.login_attempts where started < now() - interval '15 minutes';
  insert into mob_internal.login_attempts as a values ('net:' || left(p_network, 128), now(), 1)
  on conflict (bucket) do update set attempts = least(a.attempts + 1, 41)
  returning attempts into attempts_for_network;
  if attempts_for_network > 40 then return null; end if;
  insert into mob_internal.login_attempts as a values ('name:' || p_username, now(), 1)
  on conflict (bucket) do update set attempts = least(a.attempts + 1, 13)
  returning attempts into attempts_for_network;
  if attempts_for_network > 12 then return null; end if;

  select u.email into resolved_email from public.mob_handles h join auth.users u on u.id = h.user_id
  where h.username = p_username and u.email_confirmed_at is not null;
  return resolved_email;
end;
$$;
revoke all on function public.mob_login_email(text, text) from public, anon, authenticated;
grant execute on function public.mob_login_email(text, text) to service_role;

create table if not exists public.mob_companion (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  device_id uuid not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  primary key (user_id, device_id)
);
alter table public.mob_companion enable row level security;
revoke all on public.mob_companion from public, anon, authenticated;
grant select, insert, update, delete on public.mob_companion to authenticated;
drop policy if exists mob_companion_owner on public.mob_companion;
create policy mob_companion_owner on public.mob_companion for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function mob_internal.companion_policy(p_hash text)
returns table (block_shorts boolean, daily_limit_minutes smallint)
language sql stable security definer set search_path = ''
as $$
  select coalesce(s.block_shorts, false), coalesce(s.daily_limit_minutes, 0::smallint)
  from public.mob_companion c left join public.mob_settings s using (user_id)
  where c.token_hash = p_hash;
$$;
grant usage on schema mob_internal to anon;
revoke all on function mob_internal.companion_policy(text) from public, anon, authenticated;
grant execute on function mob_internal.companion_policy(text) to anon;

create or replace function public.mob_companion_policy(p_token text)
returns table (block_shorts boolean, daily_limit_minutes smallint)
language sql stable security invoker set search_path = ''
as $$
  select * from mob_internal.companion_policy(
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
  )
  where p_token ~ '^[a-f0-9]{64}$';
$$;
revoke all on function public.mob_companion_policy(text) from public, anon, authenticated;
grant execute on function public.mob_companion_policy(text) to anon;

commit;

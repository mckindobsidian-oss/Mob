-- Apply after the Mob account migration on new and existing projects.
begin;

create table if not exists public.mob_youtube_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  device_id uuid not null,
  seconds integer not null check (seconds between 0 and 86400),
  primary key (user_id, day, device_id)
);
alter table public.mob_youtube_usage enable row level security;
revoke all on public.mob_youtube_usage from public, anon, authenticated;
grant select on public.mob_youtube_usage to authenticated;
drop policy if exists mob_youtube_usage_owner on public.mob_youtube_usage;
create policy mob_youtube_usage_owner on public.mob_youtube_usage for select to authenticated
  using ((select auth.uid()) = user_id);

-- Companion tokens can report cumulative YouTube seconds and read only policy
-- and the combined total. They cannot read the account or browsing history.
create or replace function mob_internal.youtube_budget(p_token text, p_day date, p_seconds integer)
returns table (block_shorts boolean, daily_limit_minutes smallint, total_seconds bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid;
  companion_id uuid;
  today date := (now() at time zone 'UTC')::date;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return; end if;
  select c.user_id, c.device_id into owner_id, companion_id
  from public.mob_companion c
  where c.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex');
  if not found then return; end if;

  if p_day = today and p_seconds between 1 and 86400 then
    insert into public.mob_youtube_usage as usage (user_id, day, device_id, seconds)
    values (owner_id, today, companion_id, p_seconds)
    on conflict (user_id, day, device_id) do update set seconds = excluded.seconds
    where usage.seconds < excluded.seconds;
  end if;

  return query select coalesce(s.block_shorts, false), coalesce(s.daily_limit_minutes, 0::smallint),
    (select coalesce(sum(u.seconds), 0) from public.mob_youtube_usage u where u.user_id = owner_id and u.day = today)
  from (values (owner_id)) as owner(id)
  left join public.mob_settings s on s.user_id = owner.id;
end;
$$;
revoke all on function mob_internal.youtube_budget(text, date, integer) from public, anon, authenticated;
grant execute on function mob_internal.youtube_budget(text, date, integer) to anon;

create or replace function public.mob_youtube_budget(p_token text, p_day date, p_seconds integer)
returns table (block_shorts boolean, daily_limit_minutes smallint, total_seconds bigint)
language sql security invoker set search_path = ''
as $$ select * from mob_internal.youtube_budget(p_token, p_day, p_seconds); $$;
revoke all on function public.mob_youtube_budget(text, date, integer) from public, anon, authenticated;
grant execute on function public.mob_youtube_budget(text, date, integer) to anon;

commit;

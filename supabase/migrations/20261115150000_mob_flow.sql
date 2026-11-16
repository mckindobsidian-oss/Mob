begin;

alter table public.mob_settings
  add column if not exists blocked_sites text[] not null default '{}' check (cardinality(blocked_sites) <= 30);

create table if not exists mob_internal.flow_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cleared_at bigint not null default 0,
  hidden text[] not null default '{}'
);
create table if not exists mob_internal.flow_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  hour timestamptz not null,
  source text not null check (source in ('web', 'mobile', 'desktop', 'website', 'app')),
  label text not null check (char_length(label) between 1 and 100),
  seconds integer not null check (seconds between 1 and 3600),
  visits integer not null check (visits between 0 and 3600),
  primary key (user_id, device_id, hour, source, label)
);
alter table mob_internal.flow_preferences enable row level security;
alter table mob_internal.flow_activity enable row level security;

create or replace function mob_internal.write_flow(owner uuid, device uuid, generation bigint, batch jsonb, browser boolean)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_generation bigint;
begin
  insert into mob_internal.flow_preferences(user_id) values (owner) on conflict do nothing;
  select cleared_at into current_generation from mob_internal.flow_preferences where user_id = owner for update;
  if generation is distinct from current_generation or jsonb_typeof(batch) <> 'array'
     or jsonb_array_length(batch) > 120 or octet_length(batch::text) > 24000 then return current_generation; end if;
  insert into mob_internal.flow_activity as activity
    select owner, device, r.hour, r.source, r.label, max(r.seconds), max(r.visits)
    from jsonb_to_recordset(batch) as r(hour timestamptz, source text, label text, seconds int, visits int)
    where r.hour = date_trunc('hour', r.hour) and r.hour <= now() and r.hour >= now() - interval '8 days'
      and char_length(r.label) between 1 and 100 and r.seconds between 1 and 3600 and r.visits between 0 and 3600
      and ((browser and r.source = 'website') or (not browser and r.source in ('web','desktop','mobile','app')))
    group by r.hour, r.source, r.label
  on conflict (user_id, device_id, hour, source, label) do update
    set seconds = greatest(activity.seconds, excluded.seconds), visits = greatest(activity.visits, excluded.visits);
  delete from mob_internal.flow_activity where user_id = owner and hour < now() - interval '8 days';
  return current_generation;
end $$;
revoke all on function mob_internal.write_flow(uuid, uuid, bigint, jsonb, boolean) from public;

create or replace function mob_internal.flow_sync(device uuid, generation bigint, batch jsonb)
returns bigint language sql security definer set search_path = '' as $$
  select mob_internal.write_flow(auth.uid(), device, generation, batch, false) where auth.uid() is not null
$$;
create or replace function mob_internal.flow_browser(token text, generation bigint, batch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid; device uuid; epoch bigint;
begin
  if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
  select user_id, device_id into owner, device from public.mob_companion
    where token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(token, 'UTF8')), 'hex');
  if not found then return null; end if;
  epoch := mob_internal.write_flow(owner, device, generation, batch, true);
  return (select jsonb_build_object('epoch', epoch, 'sites', coalesce(s.blocked_sites, '{}'),
    'theme', coalesce(s.theme,'plain'), 'shorts', coalesce(s.block_shorts,false),
    'until', case when s.timer_state->>'mode' = 'focus' then s.timer_state->'endsAt' end)
    from (values (owner)) as u(id) left join public.mob_settings s on s.user_id = u.id);
end $$;

create or replace function mob_internal.flow_snapshot()
returns jsonb language sql stable security definer set search_path = '' as $$
  with visible as (
    select a.* from mob_internal.flow_activity a
    where a.user_id = auth.uid() and a.hour >= now() - interval '7 days'
      and not exists (select 1 from mob_internal.flow_preferences p where p.user_id = a.user_id
        and (a.source || ':' || a.label) = any(p.hidden))
  ), hours as (
    select extract(epoch from hour)::bigint as hour, source, sum(seconds) as seconds
    from visible group by 1, 2
  ), labels as (
    select source, label, sum(seconds) as seconds, sum(visits) as visits
    from visible group by 1, 2 order by 3 desc, 1, 2 limit 100
  )
  select jsonb_build_object(
    'epoch', coalesce((select cleared_at from mob_internal.flow_preferences where user_id = auth.uid()), 0),
    'hidden', coalesce((select hidden from mob_internal.flow_preferences where user_id = auth.uid()), '{}'),
    'hours', coalesce((select jsonb_agg(jsonb_build_array(hour, source, seconds) order by hour, source) from hours), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_array(source,label,seconds,visits) order by seconds desc, source, label) from labels), '[]'),
    'devices', (select count(distinct device_id) from visible),
    'visits', (select coalesce(sum(visits), 0) from visible)
  ) where auth.uid() is not null
$$;

create or replace function mob_internal.flow_manage(action text, item text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); epoch bigint;
begin
  if owner is null then raise insufficient_privilege; end if;
  insert into mob_internal.flow_preferences(user_id) values (owner) on conflict do nothing;
  select cleared_at into epoch from mob_internal.flow_preferences where user_id = owner for update;
  if action = 'clear' then
    epoch := greatest(epoch + 1, (extract(epoch from clock_timestamp()) * 1000)::bigint);
    update mob_internal.flow_preferences set cleared_at = epoch where user_id = owner;
    delete from mob_internal.flow_activity where user_id = owner;
    delete from public.mob_usage where user_id = owner;
  elsif action = 'hide' and char_length(item) between 1 and 110 then
    update mob_internal.flow_preferences set hidden = array_append(hidden,item)
    where user_id = owner and cardinality(hidden) < 100 and not (item = any(hidden));
  elsif action = 'show' then
    update mob_internal.flow_preferences set hidden = array_remove(hidden,item) where user_id = owner;
  else
    raise invalid_parameter_value;
  end if;
  return epoch;
end $$;

create or replace function mob_internal.delete_my_account()
returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid()
$$;

create or replace function public.mob_flow_sync(device uuid, generation bigint, batch jsonb)
returns bigint language sql security invoker set search_path = '' as $$
  select mob_internal.flow_sync(device,generation,batch)
$$;
create or replace function public.mob_flow_browser(token text, generation bigint, batch jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select mob_internal.flow_browser(token,generation,batch)
$$;
create or replace function public.mob_flow_snapshot()
returns jsonb language sql security invoker set search_path = '' as $$
  select mob_internal.flow_snapshot()
$$;
create or replace function public.mob_flow_manage(action text, item text)
returns bigint language sql security invoker set search_path = '' as $$
  select mob_internal.flow_manage(action,item)
$$;
create or replace function public.mob_delete_my_account()
returns void language sql security invoker set search_path = '' as $$
  select mob_internal.delete_my_account()
$$;

revoke all on function
  public.mob_flow_sync(uuid,bigint,jsonb), public.mob_flow_snapshot(), public.mob_flow_manage(text,text),
  public.mob_delete_my_account(), public.mob_flow_browser(text,bigint,jsonb),
  mob_internal.flow_sync(uuid,bigint,jsonb), mob_internal.flow_snapshot(), mob_internal.flow_manage(text,text),
  mob_internal.delete_my_account(), mob_internal.flow_browser(text,bigint,jsonb)
from public, anon, authenticated;
grant execute on function
  public.mob_flow_sync(uuid,bigint,jsonb), public.mob_flow_snapshot(), public.mob_flow_manage(text,text),
  public.mob_delete_my_account(), mob_internal.flow_sync(uuid,bigint,jsonb), mob_internal.flow_snapshot(),
  mob_internal.flow_manage(text,text), mob_internal.delete_my_account()
to authenticated;
grant execute on function public.mob_flow_browser(text,bigint,jsonb), mob_internal.flow_browser(text,bigint,jsonb) to anon;
revoke insert, update on public.mob_usage from authenticated;
revoke execute on function public.mob_record_usage(date,uuid,text,integer) from authenticated;
commit;

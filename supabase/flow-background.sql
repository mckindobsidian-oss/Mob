-- Apply after the existing Flow migration. Deployed to North through Mob on 2026-11-18; consolidated owner-RLS correction included.
begin;
alter table public.mob_settings add column if not exists focus_audio jsonb not null default '{"preset":"brown","volume":0.2}'::jsonb
  check (jsonb_typeof(focus_audio)='object' and octet_length(focus_audio::text)<=200);

create table if not exists mob_internal.task_revisions(user_id uuid primary key references auth.users(id) on delete cascade, revision bigint not null default 0);
revoke all on mob_internal.task_revisions from public,anon,authenticated;
alter table mob_internal.task_revisions enable row level security;
create or replace function mob_internal.bump_task_revision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=coalesce(new.user_id,old.user_id)) then return null; end if;
  insert into mob_internal.task_revisions(user_id,revision) values(coalesce(new.user_id,old.user_id),1)
  on conflict(user_id) do update set revision=mob_internal.task_revisions.revision+1;
  return null;
end $$;
revoke all on function mob_internal.bump_task_revision() from public,anon,authenticated;
drop trigger if exists mob_task_revision on public.mob_tasks;
create trigger mob_task_revision after insert or update or delete on public.mob_tasks
for each row execute function mob_internal.bump_task_revision();
grant usage on schema mob_internal to authenticated;
grant select on mob_internal.task_revisions to authenticated;
drop policy if exists task_revision_owner on mob_internal.task_revisions;
create policy task_revision_owner on mob_internal.task_revisions for select to authenticated using ((select auth.uid())=user_id);
create or replace function public.mob_task_revision()
returns bigint language sql stable security invoker set search_path='' as $$
  select coalesce((select revision from mob_internal.task_revisions where user_id=auth.uid()),0)
$$;
revoke all on function public.mob_task_revision() from public,anon;
grant execute on function public.mob_task_revision() to authenticated;
alter table public.mob_settings add column if not exists site_limits jsonb not null default '{}'::jsonb check (jsonb_typeof(site_limits)='object' and octet_length(site_limits::text)<=4000);
alter table public.mob_settings
  add column if not exists flow_hide_usage boolean not null default false,
  add column if not exists flow_hide_list boolean not null default false;
alter table public.mob_companion add column if not exists device_kind text not null default 'browser'
  check (device_kind in ('browser', 'mobile'));

create or replace function mob_internal.preserve_timer_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(old.timer_state->'updatedAt')='number'
    and (jsonb_typeof(new.timer_state->'updatedAt') is distinct from 'number'
      or new.timer_state->'updatedAt' < old.timer_state->'updatedAt')
    then new.timer_state:=old.timer_state; end if;
  return new;
end $$;
revoke all on function mob_internal.preserve_timer_revision() from public,anon,authenticated;
drop trigger if exists mob_preserve_timer_revision on public.mob_settings;
create trigger mob_preserve_timer_revision before update on public.mob_settings
  for each row execute function mob_internal.preserve_timer_revision();

create or replace function mob_internal.flow_mobile(token text, generation bigint, batch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner uuid; device uuid; epoch bigint;
begin
  if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
  select user_id, device_id into owner, device from public.mob_companion
  where device_kind = 'mobile'
    and token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(token, 'UTF8')), 'hex');
  if not found then return null; end if;
  if batch is null or jsonb_typeof(batch) <> 'array' or jsonb_array_length(batch) > 120
    or octet_length(batch::text) > 24000 then raise invalid_parameter_value; end if;
  if exists (select 1 from jsonb_array_elements(batch) r where r->>'source' is distinct from 'mobile')
    then raise invalid_parameter_value; end if;
  epoch := mob_internal.write_flow(owner,device,generation,batch,false);
  return (select jsonb_build_object('epoch', epoch, 'sites', coalesce(s.blocked_sites, '{}'),
    'shorts', coalesce(s.block_shorts,false), 'limit', coalesce(s.daily_limit_minutes,0),
    'until', case when s.timer_state->>'mode' = 'focus' then s.timer_state->'endsAt' end)
    from (values (owner)) as u(id) left join public.mob_settings s on s.user_id=u.id);
end $$;
create or replace function public.mob_flow_mobile(token text, generation bigint, batch jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select mob_internal.flow_mobile(token,generation,batch)
$$;
revoke all on function mob_internal.flow_mobile(text,bigint,jsonb), public.mob_flow_mobile(text,bigint,jsonb)
from public, anon, authenticated;
grant execute on function mob_internal.flow_mobile(text,bigint,jsonb), public.mob_flow_mobile(text,bigint,jsonb) to anon;

create or replace function mob_internal.flow_snapshot_device(device uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select mob_internal.flow_snapshot() || jsonb_build_object('own',
    coalesce((select jsonb_agg(jsonb_build_array(extract(epoch from a.hour)::bigint,a.source,a.label,a.seconds,a.visits))
      from mob_internal.flow_activity a where a.user_id=auth.uid() and a.device_id=device
      and a.hour>=now()-interval '7 days'),'[]'::jsonb))
  where auth.uid() is not null
$$;
create or replace function public.mob_flow_snapshot_device(device uuid)
returns jsonb language sql security invoker set search_path = '' as $$
  select mob_internal.flow_snapshot_device(device)
$$;
revoke all on function mob_internal.flow_snapshot_device(uuid),public.mob_flow_snapshot_device(uuid) from public,anon,authenticated;
grant execute on function mob_internal.flow_snapshot_device(uuid),public.mob_flow_snapshot_device(uuid) to authenticated;

create or replace function public.mob_delete_account(expected_user uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from expected_user then raise insufficient_privilege; end if;
  perform mob_internal.delete_my_account();
end $$;
revoke all on function public.mob_delete_account(uuid) from public,anon,authenticated;
grant execute on function public.mob_delete_account(uuid) to authenticated;

-- Invalid batches must fail, so callers never acknowledge an upload that was ignored.
create or replace function mob_internal.write_flow(owner uuid, device uuid, generation bigint, batch jsonb, browser boolean)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare current_generation bigint;
begin
  if owner is null or device is null or batch is null or jsonb_typeof(batch) <> 'array'
    or jsonb_array_length(batch) > 120 or octet_length(batch::text) > 24000
    then raise invalid_parameter_value; end if;
  insert into mob_internal.flow_preferences(user_id) values(owner) on conflict do nothing;
  select cleared_at into current_generation from mob_internal.flow_preferences where user_id=owner for update;
  if generation is distinct from current_generation then return current_generation; end if;
  if exists (
    select 1 from jsonb_to_recordset(batch) r(hour timestamptz,source text,label text,seconds int,visits int)
    where r.hour is null or r.hour <> date_trunc('hour',r.hour) or r.hour > now()
      or r.hour < now()-interval '8 days' or r.label is null or char_length(r.label) not between 1 and 100
      or r.seconds is null or r.seconds not between 1 and 3600 or r.visits is null or r.visits not between 0 and 3600
      or r.source is null or not ((browser and r.source='website')
        or (not browser and r.source in ('desktop','app')))
  ) then raise invalid_parameter_value; end if;
  insert into mob_internal.flow_activity as activity
    select owner,device,r.hour,r.source,r.label,max(r.seconds),max(r.visits)
    from jsonb_to_recordset(batch) r(hour timestamptz,source text,label text,seconds int,visits int)
    group by r.hour,r.source,r.label
    on conflict(user_id,device_id,hour,source,label) do update
    set seconds=greatest(activity.seconds,excluded.seconds),visits=greatest(activity.visits,excluded.visits);
  delete from mob_internal.flow_activity where user_id=owner and hour < now()-interval '8 days';
  return current_generation;
end $$;
revoke all on function public.mob_flow_mobile(text,bigint,jsonb), mob_internal.flow_mobile(text,bigint,jsonb) from anon, authenticated;
delete from public.mob_companion where device_kind='mobile';
delete from mob_internal.flow_activity where source in ('mobile','web');
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
    'siteLimits',coalesce(s.site_limits,'{}'::jsonb), 'siteUsage',coalesce((select jsonb_object_agg(label,seconds) from (select label,sum(seconds) as seconds from mob_internal.flow_activity where user_id=owner and source='website' and hour >= date_trunc('day',now() at time zone 'UTC') group by label) daily),'{}'::jsonb), 'theme', coalesce(s.theme,'plain'), 'shorts', coalesce(s.block_shorts,false),
    'until', case when s.timer_state->>'mode' = 'focus' then s.timer_state->'endsAt' end)
    from (values (owner)) as u(id) left join public.mob_settings s on s.user_id = u.id);
end $$;
commit;

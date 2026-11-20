-- Apply after usage-rules.sql. Retain the current UTC day and the previous 29.
begin;

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
  delete from mob_internal.flow_activity where user_id=owner and hour < (((now() at time zone 'UTC')::date - 29)::timestamp at time zone 'UTC');
  return current_generation;
end $$;

create or replace function mob_internal.flow_report(device uuid, usage_range text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with request as (
    select auth.uid() as owner, (now() at time zone 'UTC')::date as today,
      case usage_range when '7-days' then 7 when '30-days' then 30 else 1 end as days
    where usage_range in ('today', 'yesterday', '7-days', '30-days')
  ), bounds as (
    select owner, today, days,
      ((today - case when usage_range = 'yesterday' then 1 else days - 1 end)::timestamp at time zone 'UTC') as start_at,
      ((today + case when usage_range = 'yesterday' then 0 else 1 end)::timestamp at time zone 'UTC') as end_at
    from request where owner is not null
  ), prefs as (
    select p.cleared_at, p.hidden
    from mob_internal.flow_preferences p join bounds b on p.user_id = b.owner
  ), visible as (
    select a.*
    from mob_internal.flow_activity a join bounds b on a.user_id = b.owner
    where a.hour >= b.start_at and a.hour < b.end_at
      and not ((a.source || ':' || a.label) = any(coalesce((select hidden from prefs), '{}')))
  ), buckets as (
    select extract(epoch from case when (select days from bounds) = 1 then hour
      else date_trunc('day', hour, 'UTC') end)::bigint as stamp,
      source, sum(seconds) as seconds
    from visible group by 1, 2
  ), labels as (
    select source, label, sum(seconds) as seconds, sum(visits) as visits
    from visible group by 1, 2 order by 3 desc, 1, 2 limit 100
  ), recent as (
    select a.* from mob_internal.flow_activity a join bounds b on a.user_id = b.owner
    where a.hour >= now() - interval '7 days'
  ), catalog as (
    select distinct source,label from recent
    where source in ('app','desktop','website') order by source,label limit 500
  ), today_totals as (
    select source,label,sum(seconds) as seconds
    from recent where hour >= ((select today from bounds)::timestamp at time zone 'UTC')
    group by 1, 2
  )
  select jsonb_build_object(
    'range', usage_range, 'day', b.today, 'epoch', coalesce((select cleared_at from prefs), 0),
    'hidden', coalesce((select hidden from prefs), '{}'),
    'hours', coalesce((select jsonb_agg(jsonb_build_array(stamp,source,seconds) order by stamp,source) from buckets), '[]'),
    'items', coalesce((select jsonb_agg(jsonb_build_array(source,label,seconds,visits) order by seconds desc,source,label) from labels), '[]'),
    'devices', (select count(distinct device_id) from visible),
    'ownVisible', exists (select 1 from visible where device_id = device),
    'visits', (select coalesce(sum(visits), 0) from visible),
    'own', coalesce((select jsonb_agg(jsonb_build_array(extract(epoch from hour)::bigint,source,label,seconds,visits))
      from recent where device_id = device and ((hour >= b.start_at and hour < b.end_at)
        or hour >= (b.today::timestamp at time zone 'UTC'))), '[]'),
    'catalog', coalesce((select jsonb_agg(jsonb_build_array(source,label)) from catalog), '[]'),
    'totals', coalesce((select jsonb_agg(jsonb_build_array(source,label,seconds)) from today_totals), '[]')
  ) from bounds b
$$;

create or replace function public.mob_flow_report(device uuid, usage_range text)
returns jsonb
language sql stable security invoker set search_path = ''
as $$ select mob_internal.flow_report(device, usage_range) $$;

revoke all on function mob_internal.flow_report(uuid,text), public.mob_flow_report(uuid,text) from public, anon, authenticated;
grant execute on function mob_internal.flow_report(uuid,text), public.mob_flow_report(uuid,text) to authenticated;
commit;

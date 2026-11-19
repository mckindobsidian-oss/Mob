begin;
alter table public.mob_settings add column if not exists usage_rules jsonb not null default '[]'::jsonb
  check(jsonb_typeof(usage_rules)='array' and jsonb_array_length(usage_rules)<=30 and octet_length(usage_rules::text)<=30000);

create or replace function mob_internal.flow_snapshot_device(device uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select mob_internal.flow_snapshot() || jsonb_build_object(
  'day',to_char(now() at time zone 'UTC','YYYY-MM-DD'),
  'own',coalesce((select jsonb_agg(jsonb_build_array(extract(epoch from a.hour)::bigint,a.source,a.label,a.seconds,a.visits)) from mob_internal.flow_activity a where a.user_id=auth.uid() and a.device_id=device and a.hour>=now()-interval '7 days'),'[]'::jsonb),
  'catalog',coalesce((select jsonb_agg(jsonb_build_array(source,label)) from (select distinct source,label from mob_internal.flow_activity where user_id=auth.uid() and source in ('app','desktop','website') and hour>=now()-interval '7 days' order by source,label limit 500) entries),'[]'::jsonb),
  'totals',coalesce((select jsonb_agg(jsonb_build_array(source,label,seconds)) from (select source,label,sum(seconds) as seconds from mob_internal.flow_activity where user_id=auth.uid() and hour>=date_trunc('day',now() at time zone 'UTC') group by source,label) entries),'[]'::jsonb)
 ) where auth.uid() is not null
$$;
revoke all on function mob_internal.flow_snapshot_device(uuid) from public,anon;
grant execute on function mob_internal.flow_snapshot_device(uuid) to authenticated;

create or replace function mob_internal.flow_browser(token text,generation bigint,batch jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid;device uuid;epoch bigint;
begin
 if token is null or token!~'^[a-f0-9]{64}$' then return null;end if;
 select user_id,device_id into owner,device from public.mob_companion where device_kind='browser' and token_hash=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(token,'UTF8')),'hex');
 if not found then return null;end if;
 epoch:=mob_internal.write_flow(owner,device,generation,batch,true);
 return (select jsonb_build_object('day',to_char(now() at time zone 'UTC','YYYY-MM-DD'),'epoch',epoch,'sites',coalesce(s.blocked_sites,'{}'),'siteLimits',coalesce(s.site_limits,'{}'::jsonb),'rules',coalesce(s.usage_rules,'[]'::jsonb),
 'ruleUsage',coalesce((select jsonb_object_agg(item,seconds) from (select (case when source='website' then 'website:' else 'app:' end)||lower(label) as item,sum(seconds) as seconds from mob_internal.flow_activity where user_id=owner and hour>=date_trunc('day',now() at time zone 'UTC') group by 1) totals),'{}'::jsonb),
 'siteUsage',coalesce((select jsonb_object_agg(label,seconds) from(select label,sum(seconds) as seconds from mob_internal.flow_activity where user_id=owner and source='website' and hour>=date_trunc('day',now() at time zone 'UTC') group by label) totals),'{}'::jsonb),
 'theme',coalesce(s.theme,'plain'),'shorts',coalesce(s.block_shorts,false),'until',case when s.timer_state->>'mode'='focus' then s.timer_state->'endsAt' end)
 from(values(owner)) u(id) left join public.mob_settings s on s.user_id=u.id);
end $$;
commit;

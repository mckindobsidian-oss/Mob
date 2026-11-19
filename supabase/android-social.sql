begin;
-- Android publishes only an opted-in aggregate Pomodoro score, never app usage.
create table if not exists mob_internal.android_focus_scores (
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null,
 minutes bigint not null check(minutes between 0 and 100000000),
 primary key(user_id,device_id)
);
alter table mob_internal.android_focus_scores enable row level security;
revoke all on mob_internal.android_focus_scores from public,anon,authenticated;

create or replace function mob_internal.leaderboard()
returns table(username text, minutes bigint, "position" bigint)
language sql stable security definer set search_path=''
as $$
 with contributions as (
  select user_id,sum(minutes)::bigint as minutes from public.mob_focus_sessions group by user_id
  union all
  select user_id,sum(minutes)::bigint from mob_internal.android_focus_scores group by user_id
 ), scores as (
  select c.user_id,sum(c.minutes)::bigint as minutes from contributions c group by c.user_id
 )
 select h.username,c.minutes,rank() over(order by c.minutes desc)
 from public.mob_handles h join public.mob_settings s using(user_id) join scores c using(user_id)
 where (select auth.uid()) is not null and s.share_score
 order by c.minutes desc,h.username limit 100;
$$;
revoke all on function mob_internal.leaderboard() from public,anon,authenticated;
grant execute on function mob_internal.leaderboard() to authenticated;

create or replace function mob_internal.android_social(device uuid,total_minutes bigint)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare owner_id uuid:=(select auth.uid()); sharing boolean;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if device is null or total_minutes is null or total_minutes<0 or total_minutes>100000000 then raise exception 'Invalid score'; end if;
 select share_score into sharing from public.mob_settings where user_id=owner_id;
 if coalesce(sharing,false) and total_minutes>0 then
  insert into mob_internal.android_focus_scores(user_id,device_id,minutes) values(owner_id,device,total_minutes)
  on conflict(user_id,device_id) do update set minutes=greatest(android_focus_scores.minutes,excluded.minutes)
  where android_focus_scores.minutes<excluded.minutes;
 end if;
 return jsonb_build_object('sharing',coalesce(sharing,false),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from mob_internal.leaderboard() r),'[]'::jsonb));
end;
$$;
revoke all on function mob_internal.android_social(uuid,bigint) from public,anon,authenticated;
grant execute on function mob_internal.android_social(uuid,bigint) to authenticated;
create or replace function public.mob_android_social(device uuid,total_minutes bigint)
returns jsonb language sql security invoker set search_path=''
as $$ select mob_internal.android_social(device,total_minutes); $$;
revoke all on function public.mob_android_social(uuid,bigint) from public,anon,authenticated;
grant execute on function public.mob_android_social(uuid,bigint) to authenticated;
commit;

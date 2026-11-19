begin;
create or replace function mob_internal.leaderboard_photos()
returns table(username text,minutes bigint,"position" bigint,photo_url text)
language sql stable security definer set search_path=''
as $$
 select r.username,r.minutes,r.position,
 case when length(coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture',''))<=512
 and coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture','') ~ '^https://([a-zA-Z0-9-]+\.)?googleusercontent\.com/'
 then coalesce(u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture') else '' end
 from mob_internal.leaderboard() r join public.mob_handles h on h.username=r.username
 join auth.users u on u.id=h.user_id
 where (select auth.uid()) is not null order by r.position,r.username;
$$;
revoke all on function mob_internal.leaderboard_photos() from public,anon,authenticated;
grant execute on function mob_internal.leaderboard_photos() to authenticated;
create or replace function public.mob_leaderboard_photos()
returns table(username text,minutes bigint,"position" bigint,photo_url text)
language sql stable security invoker set search_path=''
as $$ select * from mob_internal.leaderboard_photos(); $$;
revoke all on function public.mob_leaderboard_photos() from public,anon,authenticated;
grant execute on function public.mob_leaderboard_photos() to authenticated;
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
 return jsonb_build_object('sharing',coalesce(sharing,false),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from mob_internal.leaderboard_photos() r),'[]'::jsonb));
end;
$$;
revoke all on function mob_internal.android_social(uuid,bigint) from public,anon,authenticated;
grant execute on function mob_internal.android_social(uuid,bigint) to authenticated;
commit;

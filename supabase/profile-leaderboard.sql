begin;

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
 select h.username,coalesce(c.minutes,0),rank() over(order by coalesce(c.minutes,0) desc)
 from public.mob_handles h join public.mob_settings s using(user_id) left join scores c using(user_id)
 where (select auth.uid()) is not null and s.share_score
 order by coalesce(c.minutes,0) desc,h.username limit 100;
$$;
revoke all on function mob_internal.leaderboard() from public,anon,authenticated;
grant execute on function mob_internal.leaderboard() to authenticated;

-- Report password presence only for the authenticated account.
create or replace function mob_internal.has_password()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select nullif(u.encrypted_password, '') is not null
    from auth.users u where u.id = (select auth.uid())), false)
$$;
revoke all on function mob_internal.has_password() from public, anon, authenticated;
grant execute on function mob_internal.has_password() to authenticated;
create or replace function public.mob_has_password()
returns boolean language sql stable security invoker set search_path = ''
as $$ select mob_internal.has_password() $$;
revoke all on function public.mob_has_password() from public, anon, authenticated;
grant execute on function public.mob_has_password() to authenticated;
commit;

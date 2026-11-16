begin;

create table if not exists public.mob_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  username text not null default '' check (username = '' or username ~ '^[a-z0-9-]{1,24}$'),
  focus_minutes smallint not null default 25 check (focus_minutes between 1 and 120),
  short_minutes smallint not null default 5 check (short_minutes between 1 and 60),
  long_minutes smallint not null default 15 check (long_minutes between 1 and 90),
  long_every smallint not null default 4 check (long_every between 2 and 12),
  focus_goal smallint not null default 2 check (focus_goal between 1 and 20),
  auto_break boolean not null default false,
  auto_focus boolean not null default false,
  sound boolean not null default true,
  notifications boolean not null default false,
  theme text not null default 'plain' check (theme in ('plain', 'daylight', 'ocean', 'forest', 'photo')),
  photo text not null default '' check (length(photo) <= 450000),
  onboarded boolean not null default false,
  flow_tracking boolean not null default false,
  block_shorts boolean not null default false,
  motion boolean not null default true,
  spotify text not null default '' check (length(spotify) <= 160)
);

create table if not exists public.mob_tasks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 140),
  project text not null default '' check (length(project) <= 35),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date check (due_date between '1900-01-01' and '2199-12-31'),
  reminder_time time,
  completed_day date check (completed_day between '1900-01-01' and '2199-12-31'),
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check (reminder_time is null or due_date is not null)
);

create table if not exists public.mob_focus_sessions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  day date not null check (day between '1900-01-01' and '2199-12-31'),
  minutes smallint not null check (minutes between 1 and 120),
  task_id uuid,
  primary key (user_id, id)
);

create table if not exists public.mob_usage (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null check (day between '1900-01-01' and '2199-12-31'),
  device_id uuid not null,
  device_kind text not null check (device_kind in ('mobile', 'desktop')),
  seconds integer not null check (seconds between 0 and 86400),
  primary key (user_id, day, device_id)
);

alter table public.mob_settings enable row level security;
alter table public.mob_tasks enable row level security;
alter table public.mob_focus_sessions enable row level security;
alter table public.mob_usage enable row level security;

revoke all on public.mob_settings, public.mob_tasks, public.mob_focus_sessions, public.mob_usage from public, anon, authenticated;
grant select, insert, update on public.mob_settings, public.mob_focus_sessions, public.mob_usage to authenticated;
grant select, insert, update, delete on public.mob_tasks to authenticated;

drop policy if exists mob_settings_owner on public.mob_settings;
create policy mob_settings_owner on public.mob_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists mob_tasks_owner on public.mob_tasks;
create policy mob_tasks_owner on public.mob_tasks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists mob_sessions_owner on public.mob_focus_sessions;
create policy mob_sessions_owner on public.mob_focus_sessions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists mob_usage_owner on public.mob_usage;
create policy mob_usage_owner on public.mob_usage for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- A retry or a delayed update from another tab cannot lower a device's total.
create or replace function public.mob_record_usage(p_day date, p_device uuid, p_kind text, p_seconds integer)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.mob_usage as usage (user_id, day, device_id, device_kind, seconds)
  values ((select auth.uid()), p_day, p_device, p_kind, p_seconds)
  on conflict (user_id, day, device_id) do update
  set seconds = greatest(usage.seconds, excluded.seconds);
$$;

revoke all on function public.mob_record_usage(date, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.mob_record_usage(date, uuid, text, integer) to authenticated;

commit;

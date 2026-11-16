-- Run after schema.sql in the Supabase SQL Editor.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') as anonymous_read,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_read
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('mob_settings', 'mob_tasks', 'mob_focus_sessions', 'mob_usage')
order by table_name;

select tablename, policyname, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('mob_settings', 'mob_tasks', 'mob_focus_sessions', 'mob_usage')
order by tablename;

select has_function_privilege('anon', 'public.mob_record_usage(date,uuid,text,integer)', 'EXECUTE') as anonymous_record_usage,
       has_function_privilege('authenticated', 'public.mob_record_usage(date,uuid,text,integer)', 'EXECUTE') as authenticated_record_usage;

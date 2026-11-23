begin;
-- Keep avatars out of auth tokens and unrelated sync responses.
create table if not exists public.mob_profile_photos (
 user_id uuid primary key references auth.users(id) on delete cascade,
 photo text not null check (octet_length(photo) <= 32768 and photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/=]+$')
);
alter table public.mob_profile_photos enable row level security;
revoke all on public.mob_profile_photos from public, anon, authenticated;
grant select, insert, update, delete on public.mob_profile_photos to authenticated;
drop policy if exists mob_profile_photo_owner on public.mob_profile_photos;
create policy mob_profile_photo_owner on public.mob_profile_photos to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant update (username) on public.mob_handles to authenticated;
commit;

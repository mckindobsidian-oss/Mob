alter table public.mob_settings add column if not exists photo_etag text generated always as (md5(photo)) stored;

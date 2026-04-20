-- Supabase schema for luxury wedding photography portfolio
-- Run this script in Supabase SQL Editor

create extension if not exists pgcrypto;

-- Albums table
create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_url text,
  type text not null check (type in ('wedding', 'portfolio')),
  date date,
  visible boolean not null default false,
  display_order integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.albums add column if not exists description text;
alter table public.albums add column if not exists display_order integer not null default 1;


-- Photos table
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  url text not null,
  width integer,
  height integer,
  display_order integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists idx_albums_type_visible on public.albums(type, visible);
create index if not exists idx_albums_slug on public.albums(slug);
create index if not exists idx_albums_type_order on public.albums(type, display_order, date desc, created_at desc);
create index if not exists idx_photos_album_order on public.photos(album_id, display_order);

alter table public.albums enable row level security;
alter table public.photos enable row level security;

-- Drop old policies if re-running

drop policy if exists "albums_public_select_visible" on public.albums;
drop policy if exists "albums_admin_all" on public.albums;
drop policy if exists "photos_public_select_visible_albums" on public.photos;
drop policy if exists "photos_admin_all" on public.photos;

-- Public read access: only visible albums
create policy "albums_public_select_visible"
on public.albums
for select
to anon, authenticated
using (visible = true);

-- Admin full CRUD via authenticated Supabase user
create policy "albums_admin_all"
on public.albums
for all
to authenticated
using (true)
with check (true);

-- Public read access to photos only when the parent album is visible
create policy "photos_public_select_visible_albums"
on public.photos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.albums a
    where a.id = photos.album_id
      and a.visible = true
  )
);

-- Admin full CRUD on photos
create policy "photos_admin_all"
on public.photos
for all
to authenticated
using (true)
with check (true);

-- Storage bucket for images
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = excluded.public;

-- Reset storage policies if they already exist

drop policy if exists "photos_bucket_public_read" on storage.objects;
drop policy if exists "photos_bucket_auth_insert" on storage.objects;
drop policy if exists "photos_bucket_auth_update" on storage.objects;
drop policy if exists "photos_bucket_auth_delete" on storage.objects;

-- Public can read photos bucket objects
create policy "photos_bucket_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'photos');

-- Authenticated admin can upload objects
create policy "photos_bucket_auth_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'photos');

-- Authenticated admin can update objects
create policy "photos_bucket_auth_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'photos')
with check (bucket_id = 'photos');

-- Authenticated admin can delete objects
create policy "photos_bucket_auth_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'photos');


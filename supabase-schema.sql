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

-- Singleton page content for About route
create table if not exists public.about_content (
  id integer primary key default 1 check (id = 1),
  photo_url text,
  story text not null,
  values_text text,
  personal_text text,
  testimonials jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_albums_type_visible on public.albums(type, visible);
create index if not exists idx_albums_slug on public.albums(slug);
create index if not exists idx_albums_type_order on public.albums(type, display_order, date desc, created_at desc);
create index if not exists idx_photos_album_order on public.photos(album_id, display_order);
create index if not exists idx_about_content_id on public.about_content(id);

alter table public.albums enable row level security;
alter table public.photos enable row level security;
alter table public.about_content enable row level security;

-- Drop old policies if re-running

drop policy if exists "albums_public_select_visible" on public.albums;
drop policy if exists "albums_admin_all" on public.albums;
drop policy if exists "photos_public_select_visible_albums" on public.photos;
drop policy if exists "photos_admin_all" on public.photos;
drop policy if exists "about_public_select" on public.about_content;
drop policy if exists "about_admin_all" on public.about_content;

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

-- Public read for About page content
create policy "about_public_select"
on public.about_content
for select
to anon, authenticated
using (true);

-- Admin edit access for About page content
create policy "about_admin_all"
on public.about_content
for all
to authenticated
using (true)
with check (true);

insert into public.about_content (id, story, values_text, personal_text, testimonials)
values (
  1,
  $$Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me.

Honestly, people started noticing things in my photos that I did not even see myself - raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in perfect poses. You want to see the real story of your day in these photos. And I handle that perfectly... or so they tell me.

Some say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just us.

Your wedding day? Trust me, I've got this.$$,
  'I work quietly, observe honestly, and guide only when it helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.',
  'Originally from Ukraine, now based near Aarhus. I bring 10 years of wedding photography experience across Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.',
  '[{"name":"Volodymyr Ostapchuk (TV Presenter)","quote":"Oleh has an incredible talent for capturing genuine emotions. Our wedding photos tell the perfect story of our day. Highly recommended!"},{"name":"Jerry Heil (Singer & Songwriter)","quote":"We had a cozy winter photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic."},{"name":"Oleksandr Popov (Actor)","quote":"I worked with Oleh on a shoot for my TV series. He is an absolute professional with a great eye for cinematic detail."},{"name":"Amalie Frank","quote":"Wow, hvor ser det godt ud! Tusind tusind tak for det - kaempe anbefaling! Der har virkelig vaeret stor ros for alle billederne fra alle gaester og slottet ogsaa. Det har vaeret fantastisk at have arbejdet med jer."}]'::jsonb
)
on conflict (id) do nothing;

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


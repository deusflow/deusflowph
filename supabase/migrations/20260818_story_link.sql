-- Migration: Add linked_album_id to photos table for Story Connection feature
-- This allows portfolio highlights to link directly to full wedding stories

alter table public.photos
add column if not exists linked_album_id uuid references public.albums(id) on delete set null;

create index if not exists idx_photos_linked_album on public.photos(linked_album_id);

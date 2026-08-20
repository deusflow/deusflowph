-- Migration: Add gallery_photos to about_content
-- Date: 2026-08-20

alter table public.about_content
add column if not exists gallery_photos jsonb not null default '[]'::jsonb;

-- =========================================================================
-- Migration: 20260819_site_translations.sql
-- Description: Creates the site_translations table, RLS policies,
--              merge_site_translations RPC function, and explicit GRANT/REVOKE rules.
-- =========================================================================

-- 1. Create table site_translations
create table if not exists public.site_translations (
  lang text primary key check (lang in ('da', 'ua', 'en')),
  raw_data jsonb not null default '{}'::jsonb,
  dict_map jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.site_translations enable row level security;

-- 3. Policy: Public read access for all visitors (anon + authenticated)
drop policy if exists "Allow public read access to site_translations" on public.site_translations;
create policy "Allow public read access to site_translations"
  on public.site_translations
  for select
  using (true);

-- 4. Policy: Authenticated users (admin) can insert/update
drop policy if exists "Allow authenticated modify site_translations" on public.site_translations;
create policy "Allow authenticated modify site_translations"
  on public.site_translations
  for all
  to authenticated
  using (true)
  with check (true);

-- 5. RPC Function: Atomic shallow merge of translations
create or replace function public.merge_site_translations(
  p_lang text,
  p_raw_data jsonb,
  p_dict_map jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.site_translations (lang, raw_data, dict_map, updated_at)
  values (p_lang, p_raw_data, p_dict_map, now())
  on conflict (lang) do update
  set
    raw_data = public.site_translations.raw_data || excluded.raw_data,
    dict_map = public.site_translations.dict_map || excluded.dict_map,
    updated_at = now();
end;
$$;

-- 6. Explicit GRANTs and Security Hardening
-- Allow public select on the table
grant select on public.site_translations to anon, authenticated;

-- Restrict direct table write access to authenticated users only
grant insert, update on public.site_translations to authenticated;
revoke insert, update, delete on public.site_translations from anon, public;

-- Hardening: Revoke RPC execution from anon/public and grant ONLY to authenticated & service_role
revoke execute on function public.merge_site_translations(text, jsonb, jsonb) from public, anon;
grant execute on function public.merge_site_translations(text, jsonb, jsonb) to authenticated, service_role;

-- 7. Initial Seed: Default rows for da, ua, en (if not exists)
insert into public.site_translations (lang, raw_data, dict_map, updated_at)
values 
  ('da', '{}'::jsonb, '{}'::jsonb, now()),
  ('ua', '{}'::jsonb, '{}'::jsonb, now()),
  ('en', '{}'::jsonb, '{}'::jsonb, now())
on conflict (lang) do nothing;

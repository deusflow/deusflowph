-- SUPABASE MIGRATION: Site settings & Pricing toggles
-- Copy and run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Add package visibility columns to pricing_content
alter table public.pricing_content add column if not exists show_essentials boolean not null default true;
alter table public.pricing_content add column if not exists show_signature boolean not null default true;
alter table public.pricing_content add column if not exists show_luxury boolean not null default true;
alter table public.pricing_content add column if not exists show_session boolean not null default true;

-- Add navigation tab visibility columns to pricing_content
alter table public.pricing_content add column if not exists show_weddings boolean not null default true;
alter table public.pricing_content add column if not exists show_portfolio boolean not null default true;
alter table public.pricing_content add column if not exists show_about boolean not null default true;
alter table public.pricing_content add column if not exists show_pricing boolean not null default true;

-- Add SEO homepage metadata fields
alter table public.pricing_content add column if not exists homepage_title text;
alter table public.pricing_content add column if not exists homepage_description text;

-- Add SMM / Contact config fields
alter table public.pricing_content add column if not exists instagram_handle text;
alter table public.pricing_content add column if not exists instagram_dm_url text;
alter table public.pricing_content add column if not exists telegram_url text;
alter table public.pricing_content add column if not exists whatsapp_url text;

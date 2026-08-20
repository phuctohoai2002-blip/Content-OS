-- Content OS schema alignment
-- Aligns the existing Supabase schema with the current frontend CRUD/dashboard code.
-- IMPORTANT: This migration intentionally does NOT modify the existing
-- pillar_performance / topic_performance views. Those views already exist
-- in the database with a richer schema and must be preserved.

begin;

-- ============================================================
-- 1. RESEARCH / CRUD COMPATIBILITY
-- ============================================================

alter table public.creators
    add column if not exists handle text;

alter table public.sources
    add column if not exists score integer
        check (score >= 1 and score <= 5),
    add column if not exists creator_name text;

create index if not exists creators_niche_id_idx on public.creators(niche_id);
create index if not exists sources_niche_id_idx on public.sources(niche_id);
create index if not exists sources_creator_id_idx on public.sources(creator_id);

-- ============================================================
-- 2. TAXONOMY / TAGS COMPATIBILITY
-- ============================================================

alter table public.tags
    add column if not exists slug text,
    add column if not exists description text,
    add column if not exists updated_at timestamptz not null default now();

-- Backfill slugs for existing tags.
update public.tags
set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';

alter table public.tags alter column slug set not null;

create unique index if not exists tags_slug_unique_idx
    on public.tags(slug);

create unique index if not exists tags_name_lower_idx
    on public.tags(lower(name));

-- ============================================================
-- 3. NICHE CODE COMPATIBILITY
-- ============================================================

create or replace function public.generate_niche_code()
returns trigger
language plpgsql
as $$
declare
    base_code text;
    candidate text;
    suffix integer := 1;
begin
    if new.niche_code is not null and btrim(new.niche_code) <> '' then
        new.niche_code := upper(btrim(new.niche_code));
        return new;
    end if;

    base_code := upper(regexp_replace(btrim(new.name), '[^A-Za-z0-9]+', '', 'g'));
    if base_code = '' then
        base_code := 'NICHE';
    end if;

    candidate := left(base_code, 20);

    while exists (
        select 1
        from public.niches n
        where n.niche_code = candidate
          and n.id <> coalesce(
              new.id,
              '00000000-0000-0000-0000-000000000000'::uuid
          )
    ) loop
        candidate := left(base_code, 17) || lpad(suffix::text, 3, '0');
        suffix := suffix + 1;
    end loop;

    new.niche_code := candidate;
    return new;
end;
$$;

drop trigger if exists niches_generate_code on public.niches;

create trigger niches_generate_code
before insert or update of name, niche_code on public.niches
for each row
execute function public.generate_niche_code();

-- ============================================================
-- 4. VIDEO COMPATIBILITY
-- ============================================================

alter table public.videos
    add column if not exists video_id text;

create unique index if not exists videos_video_id_unique_idx
    on public.videos(video_id)
    where video_id is not null and btrim(video_id) <> '';

create index if not exists videos_niche_id_idx on public.videos(niche_id);
create index if not exists videos_pillar_id_idx on public.videos(pillar_id);
create index if not exists videos_topic_id_idx on public.videos(topic_id);
create index if not exists videos_creator_id_idx on public.videos(creator_id);

-- ============================================================
-- 5. UPDATED_AT TRIGGER FOR TAGS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists tags_set_updated_at on public.tags;

create trigger tags_set_updated_at
before update on public.tags
for each row
execute function public.set_updated_at();

-- ============================================================
-- 6. EXISTING PERFORMANCE VIEWS
-- ============================================================
-- DO NOT CREATE, REPLACE, ALTER, OR DROP these views here.
-- The database already contains richer definitions for:
--   public.pillar_performance
--   public.topic_performance
--
-- Keeping them untouched avoids PostgreSQL error 42P16
-- (cannot drop columns from view) and preserves existing dashboard metrics.

commit;

-- Content OS taxonomy + video metadata extension
-- Run this migration in Supabase SQL Editor once.

begin;

create table if not exists public.tags (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists tags_name_lower_idx on public.tags (lower(name));

alter table public.videos add column if not exists niche_id uuid references public.niches(id) on delete set null;
alter table public.videos add column if not exists pillar_id uuid references public.pillars(id) on delete set null;
alter table public.videos add column if not exists topic_id uuid references public.topics(id) on delete set null;
alter table public.videos add column if not exists tags uuid[] not null default '{}';
alter table public.videos add column if not exists video_id text;

create index if not exists videos_niche_id_idx on public.videos(niche_id);
create index if not exists videos_pillar_id_idx on public.videos(pillar_id);
create index if not exists videos_topic_id_idx on public.videos(topic_id);

-- Use video_id for the external/platform video identifier.
-- The base schema's internal unique identifier remains video_code.
create unique index if not exists videos_video_id_unique_idx
    on public.videos(video_id)
    where video_id is not null and btrim(video_id) <> '';

-- Basic RLS policies for the personal-use app. Adjust to your auth model later if needed.
alter table public.tags enable row level security;
drop policy if exists "tags_select_authenticated" on public.tags;
create policy "tags_select_authenticated" on public.tags for select to authenticated using (true);
drop policy if exists "tags_insert_authenticated" on public.tags;
create policy "tags_insert_authenticated" on public.tags for insert to authenticated with check (true);
drop policy if exists "tags_update_authenticated" on public.tags;
create policy "tags_update_authenticated" on public.tags for update to authenticated using (true) with check (true);
drop policy if exists "tags_delete_authenticated" on public.tags;
create policy "tags_delete_authenticated" on public.tags for delete to authenticated using (true);

commit;

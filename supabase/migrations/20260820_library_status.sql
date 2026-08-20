-- Unified Library workflow
-- recorded = newly bookmarked/recorded source video
-- downloaded -> editing -> edited -> ready -> scheduled -> published

begin;

alter table public.videos
  add column if not exists video_id text;

create unique index if not exists videos_video_id_unique_idx
  on public.videos(video_id)
  where video_id is not null and btrim(video_id) <> '';

-- Replace the old status check without touching any views.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.videos'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.videos drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.videos
  add constraint videos_status_check
  check (status in ('recorded','downloaded','editing','edited','ready','scheduled','published','skipped'));

create index if not exists videos_status_idx on public.videos(status);
create index if not exists videos_created_at_idx on public.videos(created_at desc);

commit;

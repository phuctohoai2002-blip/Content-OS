-- Calendar + tracking support for the unified Library workflow.
begin;
alter table public.videos add column if not exists scheduled_at timestamptz;
create index if not exists videos_scheduled_at_idx on public.videos(scheduled_at);
commit;

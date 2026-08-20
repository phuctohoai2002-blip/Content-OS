-- Allow tags to belong to a pillar/topic so Library > Content can suggest relevant tags.
begin;

alter table public.tags
  add column if not exists pillar_id uuid references public.pillars(id),
  add column if not exists topic_id uuid references public.topics(id);

create index if not exists tags_pillar_id_idx on public.tags(pillar_id);
create index if not exists tags_topic_id_idx on public.tags(topic_id);

commit;

begin;

alter table public.tags
  add column if not exists niche_id uuid references public.niches(id),
  add column if not exists pillar_id uuid references public.pillars(id),
  add column if not exists topic_id uuid references public.topics(id),
  add column if not exists description text;

create index if not exists tags_niche_id_idx on public.tags(niche_id);
create index if not exists tags_pillar_id_idx on public.tags(pillar_id);
create index if not exists tags_topic_id_idx on public.tags(topic_id);

commit;

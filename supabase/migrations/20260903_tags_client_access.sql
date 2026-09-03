-- Content OS uses the Supabase publishable key directly from the frontend.
-- Allow the unauthenticated client role to manage tags so taxonomy and Add Video
-- can read/write tags without requiring a separate Auth flow.

begin;

grant select, insert, update, delete on table public.tags to anon;

drop policy if exists "tags_select_anon" on public.tags;
create policy "tags_select_anon"
on public.tags for select to anon
using (true);

drop policy if exists "tags_insert_anon" on public.tags;
create policy "tags_insert_anon"
on public.tags for insert to anon
with check (true);

drop policy if exists "tags_update_anon" on public.tags;
create policy "tags_update_anon"
on public.tags for update to anon
using (true)
with check (true);

drop policy if exists "tags_delete_anon" on public.tags;
create policy "tags_delete_anon"
on public.tags for delete to anon
using (true);

commit;

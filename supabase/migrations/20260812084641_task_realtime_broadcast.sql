-- Ticket 5 (realtime board sync): every task write is broadcast to a channel
-- belonging to exactly one owner, so a second open tab or device can fold the
-- change into its board without a reload.
--
-- Broadcast-from-database rather than a `postgres_changes` subscription on
-- `task`, because postgres_changes cannot keep deletes owner-scoped: Postgres
-- can't evaluate an RLS policy against a row that no longer exists, so the
-- `old` record of a DELETE carries the primary key and nothing else. That
-- leaves only two options there — filter on `owner_id` and never see a delete
-- at all, or drop the filter and hand every subscriber every other user's task
-- deletions. A trigger sees the whole OLD row regardless, and the topic it
-- broadcasts to is authorized per user below.

create function broadcast_task_changes() returns trigger
-- Definer (so: owner `postgres`, which has bypassrls) because realtime.send()
-- inserts into realtime.messages, which is itself RLS-protected — and it
-- swallows the failure as a warning, so an invoker-rights trigger would look
-- fine while silently broadcasting nothing.
security definer
-- Empty search_path: a definer function must not resolve names through
-- whatever the caller happens to have set.
set search_path = ''
as $$
declare
  -- A delete has no NEW row, and plpgsql raises rather than returning null if
  -- NEW is touched in that case — so the owner is resolved before anything else.
  task_owner uuid := case when tg_op = 'DELETE' then old.owner_id else new.owner_id end;
begin
  perform realtime.broadcast_changes(
    'task:' || task_owner::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$ language plpgsql;

-- AFTER, so a write that ends up rolled back (an RLS violation, say) never
-- announces itself.
create trigger task_broadcast_changes after insert or update or delete on task
  for each row execute function broadcast_task_changes();

-- The other half of the isolation: a topic is only readable by the user it is
-- named after, so joining `task:<someone else>` is rejected at the join. The
-- app never broadcasts from the client, so there is no insert policy — writes
-- go through the definer trigger above.
create policy "task_realtime_receive_own" on realtime.messages for select to authenticated
  using (realtime.topic() = 'task:' || (select auth.uid())::text);

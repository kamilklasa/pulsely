-- Manual ordering inside a column. Fractional (double precision) rather than a
-- dense integer rank so a reorder only rewrites the row that moved: a card
-- dropped between two neighbours takes the midpoint of their two values.
--
-- The default is the insert timestamp in epoch seconds, and the backfill uses
-- created_at in the same scale — so a task nobody has reordered still sorts by
-- creation time (the board's previous order), and a new task lands at the
-- bottom of its column without the client having to look up the current max.
alter table task
  add column sort_order double precision not null default extract(epoch from now());

update task set sort_order = extract(epoch from created_at);

-- Serves the board's only read: one owner's tasks, ordered within each column.
create index task_owner_status_sort_order_idx on task (owner_id, status, sort_order);

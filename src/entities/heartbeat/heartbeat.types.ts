// Deliberately narrower than the table: `owner_id` is the server's business, as
// everywhere else, and `created_at` records when we were told rather than when
// the work happened — `time` is the one the user's day is made of.
export interface Heartbeat {
  id: string;
  time_entry_id: string;
  time: string;
  entity: string;
  project: string | null;
  language: string | null;
  category: string | null;
  is_write: boolean;
  // Null when the agent string named no editor we could recognise, which is
  // honest — #21's donut must be able to say "unknown" rather than invent a name.
  editor: string | null;
  user_agent: string;
}

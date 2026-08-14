// Deliberately narrower than the table. `owner_id` is the server's business, as
// everywhere else — and `token_hash` is not merely unread but ungranted, so a
// query that named it would be refused rather than return it.
export interface IngestToken {
  id: string;
  label: string;
  created_at: string;
  // Null until the ingest function accepts a batch signed with this key, which
  // is the only evidence a machine is still reporting.
  last_used_at: string | null;
}

// The plaintext key, alive only in the tab that generated it. Paired with the
// row so the UI can show the key once next to the label it was filed under.
export interface CreatedIngestToken {
  token: IngestToken;
  plaintext: string;
}

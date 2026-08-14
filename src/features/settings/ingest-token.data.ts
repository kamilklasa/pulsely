import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import { generateIngestToken, hashIngestToken } from "./ingest-token.utils";
import type { CreatedIngestToken, IngestToken } from "./ingest-token.types";

export const ingestTokenKeys = {
  all: ["ingest-tokens"] as const,
};

// token_hash is missing on purpose: the column carries no select grant, so
// naming it here would turn every read of the list into a 42501.
const TOKEN_COLUMNS = "id, label, created_at, last_used_at";

// Revoked keys are filtered out in the query rather than the component — a
// revoked key is gone as far as the user is concerned, and the row survives only
// as the record that the credential once existed.
export function useIngestTokens() {
  return useQuery({
    queryKey: ingestTokenKeys.all,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ingest_token")
        .select(TOKEN_COLUMNS)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as IngestToken[];
    },
  });
}

export function useCreateIngestToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (label: string): Promise<CreatedIngestToken> => {
      const plaintext = generateIngestToken();
      const tokenHash = await hashIngestToken(plaintext);

      // Only the hash crosses the wire. The key itself is generated and digested
      // in this tab, so there is no request body, server log or database row
      // anywhere that has ever held it — "shown once" is a property of the
      // system, not a promise the UI keeps.
      //
      // owner_id is left to its auth.uid() default: the client naming who it is
      // would be a claim, and the default is the server's own answer.
      const { data, error } = await supabase
        .from("ingest_token")
        .insert({ token_hash: tokenHash, label })
        .select(TOKEN_COLUMNS)
        .single();
      if (error) throw error;

      return { token: data as IngestToken, plaintext };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ingestTokenKeys.all });
    },
  });
}

// Filtered by id alone: the update policy scopes the statement to the caller's
// own rows, so another account's id matches nothing rather than revoking their
// key. The trigger on the table makes this one-way — nothing can clear it later.
export function useRevokeIngestToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("ingest_token")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ingestTokenKeys.all });
    },
  });
}

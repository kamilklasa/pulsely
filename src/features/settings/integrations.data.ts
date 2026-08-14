import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserIdentity } from "@supabase/supabase-js";
import { supabase } from "@/shared/api/supabase-client";

export const integrationKeys = {
  identities: ["auth", "identities"] as const,
};

// The session already says *whether* Google is connected. This is for what the
// session cannot answer: which identity to hand to `unlinkIdentity`, and how many
// other ways into the account would survive it.
export function useIdentities() {
  return useQuery({
    queryKey: integrationKeys.identities,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return data.identities;
    },
  });
}

// Leaves for Google and comes back through the OAuth callback, so nothing after
// this line runs — the returning page load is what carries the new identity.
// Requires `enable_manual_linking` on the project; without it every account gets
// the same 422, which is why that error has a message of its own.
export function useLinkGoogle() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/board` },
      });
      if (error) throw error;
    },
  });
}

export function useUnlinkGoogle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (identity: UserIdentity) => {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;

      // `unlinkIdentity` deletes the row and stops there: the access token this
      // tab is holding still lists google in `app_metadata.providers`, and that
      // is what the row reads. Minting a fresh one is what makes the copy flip
      // without a reload. The identity is gone either way, so a refresh that
      // fails leaves a stale row — not a failed disconnect to report as one.
      await supabase.auth.refreshSession();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: integrationKeys.identities });
    },
  });
}

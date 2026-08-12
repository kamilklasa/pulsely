import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";

export function useChangeEmail() {
  return useMutation({
    // Resolving does not mean the address changed — with double confirmation on,
    // it only means GoTrue accepted the request and parked it in `user.new_email`
    // until both inboxes confirm. The UI reads that field, not this result.
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: `${window.location.origin}/board` },
      );
      if (error) throw error;
    },
  });
}

// Both confirmation links get opened in a mail client, often on another device,
// so nothing pushes the outcome to this tab — the pending notice would sit there
// long after the change landed. Reopening Settings is the moment to ask: the
// refreshed session carries the new `email`, and `onAuthStateChange` feeds it
// back to the store. Clearing `new_email` is what stops this from repeating.
export function useResolvePendingEmail(pendingEmail: string) {
  useEffect(() => {
    if (pendingEmail.length === 0) return;
    void supabase.auth.refreshSession();
  }, [pendingEmail]);
}

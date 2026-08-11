import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabase-client";
import type { EmailInput } from "./sign-in.schema";

export function useSignInWithMagicLink() {
  return useMutation({
    mutationFn: async (email: EmailInput) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/board` },
      });
      if (error) throw error;
    },
  });
}

export function useSignInWithGoogle() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/board` },
      });
      if (error) throw error;
    },
  });
}

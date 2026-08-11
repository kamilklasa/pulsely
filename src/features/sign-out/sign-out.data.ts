import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/shared/api/supabase-client";

export function useSignOut() {
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      void router.navigate({ to: "/sign-in", search: { redirect: "/board" } });
    },
  });
}

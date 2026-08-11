import type { Session } from "@supabase/supabase-js";

export type AuthStatus = "pending" | "authenticated" | "unauthenticated";

export interface AuthSnapshot {
  status: AuthStatus;
  session: Session | null;
}

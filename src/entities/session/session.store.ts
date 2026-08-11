import { supabase } from "@/shared/api/supabase-client";
import type { AuthSnapshot } from "./session.types";

const listeners = new Set<() => void>();
let snapshot: AuthSnapshot = { status: "pending", session: null };

let resolveInitialized!: () => void;
const initialized = new Promise<void>((resolve) => {
  resolveInitialized = resolve;
});

function setSnapshot(next: AuthSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

supabase.auth.onAuthStateChange((_event, session) => {
  setSnapshot({ status: session ? "authenticated" : "unauthenticated", session });
  resolveInitialized();
});

export const sessionStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): AuthSnapshot {
    return snapshot;
  },
  ensureInitialized(): Promise<void> {
    return initialized;
  },
};

export type SessionStore = typeof sessionStore;

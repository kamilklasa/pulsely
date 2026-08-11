import { useSyncExternalStore } from "react";
import { sessionStore } from "./session.store";
import type { AuthSnapshot } from "./session.types";

export function useSession(): AuthSnapshot {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
}

import type { ReactNode } from "react";
import { AppDock } from "./AppDock";
import { AppHeader } from "./AppHeader";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <AppHeader />
      {/* pb-28 keeps the floating dock from covering the last row of content. */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-6 pb-28 sm:px-6">
        {children}
      </main>
      <AppDock />
    </div>
  );
}

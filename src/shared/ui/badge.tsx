import * as React from "react";

import { cn } from "@/shared/lib/utils";

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

export { Badge };

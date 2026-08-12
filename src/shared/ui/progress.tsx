import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/shared/lib/utils";

function Progress({ className, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("flex items-center gap-2.5", className)}
      {...props}
    />
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn("relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted", className)}
      {...props}
    />
  );
}

function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      // Base UI drives the fill with an inline `width` percentage, so the
      // transition has to be on width rather than a transform here.
      className={cn(
        "absolute h-full rounded-full bg-foreground/70 transition-[width] duration-500 ease-out",
        className,
      )}
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      data-slot="progress-value"
      className={cn("shrink-0 text-xs tabular-nums text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Progress, ProgressTrack, ProgressIndicator, ProgressValue };

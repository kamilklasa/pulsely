import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/shared/lib/utils";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="size-4 rounded-full bg-background shadow-2xs transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[checked]:translate-x-4"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };

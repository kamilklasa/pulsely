import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";

import { cn } from "@/shared/lib/utils";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

// `hideClose` is for popups that own their dismissal affordance — the search
// palette puts an "Esc" chip in its footer, where a floating corner X would
// land on top of the query input.
function DialogPopup({
  className,
  children,
  hideClose = false,
  ...props
}: DialogPrimitive.Popup.Props & { hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:opacity-0"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-popup"
        className={cn(
          // overflow-hidden so full-bleed children (the search palette's footer,
          // the settings scroll area) get clipped by the radius instead of
          // squaring off its corners.
          "fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-popover p-6 text-popover-foreground shadow-lg",
          // Tailwind v4 compiles `scale-*` to the standalone `scale` property,
          // not to `transform` — transitioning "transform" here animated
          // nothing and left the popup snapping to size while only its opacity
          // faded. The exit runs shorter than the entrance so dismissing feels
          // like a release rather than a second animation to sit through.
          "transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export { Dialog, DialogTrigger, DialogPopup, DialogTitle, DialogDescription, DialogClose };

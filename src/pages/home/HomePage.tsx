import { Button } from "@/shared/ui";
import { cn } from "@/shared/lib/utils";

export function HomePage() {
  return (
    <div className={cn("flex flex-col items-start gap-4 p-8")}>
      <h1 className="text-3xl font-semibold">Pulsely</h1>
      <Button>Get started</Button>
    </div>
  );
}

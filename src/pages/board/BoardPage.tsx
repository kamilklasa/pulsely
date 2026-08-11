import { useSession } from "@/entities/session";
import { SignOutButton } from "@/features/sign-out";

export function BoardPage() {
  const { session } = useSession();

  return (
    <div className="flex flex-col items-start gap-4 p-8">
      <h1 className="text-3xl font-semibold">Board</h1>
      <p className="text-muted-foreground">Signed in as {session?.user.email}</p>
      <SignOutButton />
    </div>
  );
}

import { Button } from "@/shared/ui";
import { useSignOut } from "./sign-out.data";

export function SignOutButton() {
  const signOut = useSignOut();

  return (
    <Button variant="outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
      Sign out
    </Button>
  );
}

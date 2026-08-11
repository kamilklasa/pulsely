import { Button, GoogleIcon } from "@/shared/ui";
import { useSignInWithGoogle } from "./sign-in.data";

export function GoogleSignInButton({ className }: { className?: string }) {
  const signInWithGoogle = useSignInWithGoogle();

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={className}
      onClick={() => signInWithGoogle.mutate()}
      disabled={signInWithGoogle.isPending}
    >
      <GoogleIcon data-icon="inline-start" />
      Continue with Google
    </Button>
  );
}

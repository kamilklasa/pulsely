import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui";
import { useSignOut } from "./sign-out.data";

export function SignOutButton() {
  const { t } = useTranslation("sign-out");
  const signOut = useSignOut();

  return (
    <Button variant="outline" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
      {t("signOut")}
    </Button>
  );
}

import { useTranslation } from "react-i18next";
import { GoogleSignInButton, SignInForm } from "@/features/sign-in";
import { LanguageSwitcher } from "@/features/language-switcher";
import { Logo } from "@/shared/ui";

export function SignInPage() {
  const { t } = useTranslation("sign-in");

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-8">
      <LanguageSwitcher className="fixed top-4 right-4" />
      <div className="flex w-full max-w-xs flex-col items-center gap-4">
        <Logo className="h-16 w-11" />
        <h1 className="text-2xl font-semibold mb-1">{t("heading")}</h1>
        <SignInForm className="w-full" />
        <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {t("divider")}
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleSignInButton className="w-full" />
      </div>
    </div>
  );
}

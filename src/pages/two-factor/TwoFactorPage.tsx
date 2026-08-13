import { useNavigate, useSearch } from "@tanstack/react-router";
import { TwoFactorChallenge } from "@/features/two-factor";
import { LanguageSwitcher } from "@/features/language-switcher";

export function TwoFactorPage() {
  // Addressed by path rather than through the Route object, so the page doesn't
  // have to import the route that renders it.
  const { redirect } = useSearch({ from: "/two-factor" });
  const navigate = useNavigate();

  return (
    <>
      <LanguageSwitcher className="fixed top-4 right-4" />
      <TwoFactorChallenge onVerified={() => void navigate({ to: redirect })} />
    </>
  );
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/shared/api/supabase-client";
import { Button, Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/shared/ui";
import { TotpCodeForm } from "./TotpCodeForm";
import { useTwoFactorFactors, useVerifyTotp } from "./two-factor.data";
import type { TotpFactor } from "./two-factor.types";
import { activeTotpFactors, factorLabel } from "./two-factor.utils";

// ADR-0001 made a second authenticator the only backup there is, which is worth
// nothing if the challenge can only ever address the first factor — the case the
// backup exists for is precisely that the first one is gone.
function FactorPicker({
  factors,
  selectedId,
  onSelect,
}: {
  factors: TotpFactor[];
  selectedId: string;
  onSelect: (factorId: string) => void;
}) {
  const { t } = useTranslation("two-factor");

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-xs text-muted-foreground">{t("challenge.useAnother")}</span>
      <Select
        value={selectedId}
        onValueChange={(value) => onSelect(value as string)}
        items={factors.map((factor) => ({
          value: factor.id,
          label: factorLabel(factor, t("factorFallbackName")),
        }))}
      >
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectPopup>
          {factors.map((factor) => (
            <SelectItem key={factor.id} value={factor.id}>
              {factorLabel(factor, t("factorFallbackName"))}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

// The aal1 → aal2 step at sign-in. The session already exists here, which is why
// it renders instead of the board rather than instead of the sign-in form.
export function TwoFactorChallenge({ onVerified }: { onVerified: () => void }) {
  const { t } = useTranslation("two-factor");
  const { data: allFactors, isPending } = useTwoFactorFactors();
  const verify = useVerifyTotp();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const factors = activeTotpFactors(allFactors);
  const factor = factors.find((candidate) => candidate.id === selectedId) ?? factors[0];

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-8">
      <div className="flex w-full max-w-xs flex-col gap-4">
        <ShieldCheck className="size-8 self-center text-muted-foreground" />
        <div className="text-center">
          <h1 className="text-2xl font-semibold">{t("challenge.title")}</h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("challenge.body", { name: factorLabel(factor, t("factorFallbackName")) })}
          </p>
        </div>

        {isPending || !factor ? null : (
          <>
            <TotpCodeForm
              autoFocus
              submitLabel={t("challenge.submit")}
              pendingLabel={t("challenge.submitting")}
              isPending={verify.isPending}
              error={verify.error}
              onReset={verify.reset}
              onSubmit={async (code) => {
                await verify.mutateAsync({ factorId: factor.id, code });
                onVerified();
              }}
            />
            {factors.length > 1 ? (
              <FactorPicker
                factors={factors}
                selectedId={factor.id}
                onSelect={(factorId) => {
                  // The rejection belonged to the app being switched away from.
                  verify.reset();
                  setSelectedId(factorId);
                }}
              />
            ) : null}
          </>
        )}

        {/* Without this the screen is a dead end: the session is signed in, so
            the sign-in page redirects straight back here. */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void supabase.auth.signOut();
          }}
        >
          {t("challenge.signOut")}
        </Button>
      </div>
    </div>
  );
}

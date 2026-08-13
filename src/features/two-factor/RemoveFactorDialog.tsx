import { useTranslation } from "react-i18next";
import { ShieldAlert } from "lucide-react";
import { Button, Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/shared/ui";
import { TotpCodeForm } from "./TotpCodeForm";
import { useUnenrolTotp } from "./two-factor.data";
import type { TotpFactor } from "./two-factor.types";
import { factorLabel } from "./two-factor.utils";

// ADR-0001: the code is the whole point of this dialog. Removing a factor is the
// one action here that makes the account less safe, so it asks the user to prove
// possession now rather than trusting the session that is already open.
export function RemoveFactorDialog({
  factor,
  isLastFactor,
  onOpenChange,
}: {
  factor: TotpFactor | null;
  isLastFactor: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("two-factor");
  const unenrol = useUnenrolTotp();

  return (
    <Dialog
      open={factor !== null}
      onOpenChange={(next) => {
        if (!next) unenrol.reset();
        onOpenChange(next);
      }}
    >
      <DialogPopup className="max-w-sm">
        <DialogTitle>{t("removeDialog.title")}</DialogTitle>
        <DialogDescription className="mt-1">
          {t("removeDialog.body", { name: factorLabel(factor, t("factorFallbackName")) })}
        </DialogDescription>

        {isLastFactor ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-xs leading-relaxed text-destructive">
              {t("removeDialog.lastFactor")}
            </p>
          </div>
        ) : null}

        {factor ? (
          <TotpCodeForm
            className="mt-4"
            autoFocus
            variant="destructive"
            submitLabel={t("removeDialog.confirm")}
            pendingLabel={t("removeDialog.removing")}
            isPending={unenrol.isPending}
            error={unenrol.error}
            onReset={unenrol.reset}
            onSubmit={async (code) => {
              await unenrol.mutateAsync({ factorId: factor.id, code });
              onOpenChange(false);
            }}
          />
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-4 w-full"
          onClick={() => onOpenChange(false)}
        >
          {t("removeDialog.cancel")}
        </Button>
      </DialogPopup>
    </Dialog>
  );
}

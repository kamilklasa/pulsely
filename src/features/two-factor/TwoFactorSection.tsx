import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, Smartphone } from "lucide-react";
import { Badge, Button } from "@/shared/ui";
import { RemoveFactorDialog } from "./RemoveFactorDialog";
import { TwoFactorSetupDialog } from "./TwoFactorSetupDialog";
import { useTwoFactorFactors } from "./two-factor.data";
import type { TotpFactor } from "./two-factor.types";
import {
  activeTotpFactors,
  factorLabel,
  needsBackupFactor,
  twoFactorEnabled,
} from "./two-factor.utils";

function FactorRow({ factor, onRemove }: { factor: TotpFactor; onRemove: () => void }) {
  const { t } = useTranslation("two-factor");
  const added = new Date(factor.created_at);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
      <Smartphone className="size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {factorLabel(factor, t("factorFallbackName"))}
        </p>
        <p className="text-xs text-muted-foreground">
          <time dateTime={factor.created_at}>{added.toLocaleDateString()}</time>
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        {t("remove")}
      </Button>
    </div>
  );
}

// ADR-0001 chose a second authenticator over recovery codes, which only helps if
// the user is actually told to add one — hence a standing prompt rather than a
// one-off nudge at the end of setup.
function BackupPrompt() {
  const { t } = useTranslation("two-factor");
  return (
    <div className="mt-2 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t("backupWarning.title")}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {t("backupWarning.body")}
        </p>
      </div>
    </div>
  );
}

export function TwoFactorSection() {
  const { t } = useTranslation("two-factor");
  const { data: allFactors, isPending } = useTwoFactorFactors();
  const [setupOpen, setSetupOpen] = useState(false);
  const [removing, setRemoving] = useState<TotpFactor | null>(null);

  const factors = activeTotpFactors(allFactors);
  const enabled = twoFactorEnabled(allFactors);

  return (
    <section className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">{t("title")}</h3>
            {isPending ? null : <Badge>{enabled ? t("status.on") : t("status.off")}</Badge>}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t("description")}</p>
        </div>
        <Button
          type="button"
          variant={enabled ? "outline" : "default"}
          size="sm"
          disabled={isPending}
          onClick={() => setSetupOpen(true)}
        >
          {enabled ? t("addBackup") : t("enable")}
        </Button>
      </div>

      {enabled ? (
        <div className="mt-3 flex flex-col gap-2">
          {factors.map((factor) => (
            <FactorRow key={factor.id} factor={factor} onRemove={() => setRemoving(factor)} />
          ))}
          {needsBackupFactor(allFactors) ? <BackupPrompt /> : null}
        </div>
      ) : null}

      <TwoFactorSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        // Distinguishes the rows above, and GoTrue rejects a duplicate name.
        friendlyName={
          factors.length === 0
            ? t("setup.namePlaceholder")
            : `${t("setup.namePlaceholder")} ${factors.length + 1}`
        }
      />
      <RemoveFactorDialog
        factor={removing}
        isLastFactor={factors.length === 1}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      />
    </section>
  );
}

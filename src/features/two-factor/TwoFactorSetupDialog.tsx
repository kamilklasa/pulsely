import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy } from "lucide-react";
import { Button, Dialog, DialogDescription, DialogPopup, DialogTitle } from "@/shared/ui";
import { TotpCodeForm } from "./TotpCodeForm";
import { useDiscardEnrolment, useEnrolTotp, useVerifyTotp } from "./two-factor.data";

function SecretKey({ secret }: { secret: string }) {
  const { t } = useTranslation("two-factor");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground">{t("setup.manual")}</p>
      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2">
        {/* Selectable and wrapping: a secret the user cannot read off the screen
            is no fallback at all when the camera route has already failed. */}
        <code className="min-w-0 flex-1 font-mono text-xs break-all select-all">{secret}</code>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? t("setup.copied") : t("setup.copy")}
          onClick={() => {
            void navigator.clipboard.writeText(secret).then(() => setCopied(true));
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorSetupDialog({
  open,
  onOpenChange,
  friendlyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friendlyName: string;
}) {
  const { t } = useTranslation("two-factor");
  const enrol = useEnrolTotp();
  const verify = useVerifyTotp();
  const discard = useDiscardEnrolment();

  const enrolment = enrol.data;

  // Opening the dialog is what mints the QR code — that keeps the secret out of
  // memory until it is on screen. Clearing first matters on the second opening
  // (adding a backup app): a mutation holds its previous `data` while the next
  // one is in flight, which would show the old QR over the new factor's id.
  //
  // The ref is load-bearing, not defensive: StrictMode runs this effect twice on
  // mount, and a second `enroll()` would leave an orphaned factor behind.
  const requested = useRef(false);
  useEffect(() => {
    if (!open) {
      requested.current = false;
      return;
    }
    if (requested.current) return;

    requested.current = true;
    verify.reset();
    enrol.reset();
    enrol.mutate(friendlyName);
  }, [open, friendlyName, enrol, verify]);

  // Backing out leaves an unverified factor server-side that still counts
  // against the ten-factor cap, so dismissing has to clean up after itself.
  function close() {
    if (enrolment && !verify.isSuccess) discard.mutate(enrolment.factorId);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
    >
      <DialogPopup className="max-w-sm">
        <DialogTitle>{t("setup.title")}</DialogTitle>
        <DialogDescription className="mt-1">{t("setup.scan")}</DialogDescription>

        {enrolment ? (
          <>
            {/* Supabase returns the QR as an SVG document, so it goes in as an
                image source rather than into the DOM — nothing from the server
                gets to render as markup inside the dialog. */}
            <img
              src={`data:image/svg+xml;utf-8,${encodeURIComponent(enrolment.qrCode)}`}
              alt=""
              className="mt-4 aspect-square w-40 self-center rounded-xl border border-border/60 bg-white p-2"
            />
            <SecretKey secret={enrolment.secret} />
            <TotpCodeForm
              className="mt-4"
              autoFocus
              submitLabel={t("setup.confirm")}
              pendingLabel={t("setup.confirming")}
              isPending={verify.isPending}
              error={verify.error}
              onReset={verify.reset}
              onSubmit={async (code) => {
                await verify.mutateAsync({ factorId: enrolment.factorId, code });
                onOpenChange(false);
              }}
            />
          </>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">
            {enrol.isError ? t("error.generic") : t("setup.confirming")}
          </p>
        )}

        <Button type="button" variant="ghost" size="sm" className="mt-4 w-full" onClick={close}>
          {t("setup.cancel")}
        </Button>
      </DialogPopup>
    </Dialog>
  );
}

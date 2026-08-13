import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { Button, GoogleIcon } from "@/shared/ui";
import { useIdentities, useLinkGoogle, useUnlinkGoogle } from "./integrations.data";
import {
  canUnlinkIdentity,
  googleIdentityOf,
  identityEmailOf,
  integrationErrorKey,
  isGoogleConnected,
} from "./integrations.utils";

const NOTE_ID = "integrations-google-note";

export function GoogleIntegrationRow() {
  const { t } = useTranslation("settings");
  const { session } = useSession();
  const { data: identities, error: identitiesError } = useIdentities();
  const linkGoogle = useLinkGoogle();
  const unlinkGoogle = useUnlinkGoogle();

  const connected = isGoogleConnected(session?.user);
  const googleIdentity = googleIdentityOf(identities);

  // Google present and nothing else to sign in with: disconnecting would lock the
  // account. Said up front, next to a button that stays out of reach — the server
  // would refuse it anyway, and a click that can only fail is not a choice.
  const lockedIn = Boolean(googleIdentity) && !canUnlinkIdentity(identities);
  const busy = linkGoogle.isPending || unlinkGoogle.isPending;
  // A failed identities query is the other way Disconnect ends up out of reach,
  // and the only one the user has no sentence for. Connect doesn't need the list,
  // so an unconnected account is spared an error about something it isn't doing.
  const error = linkGoogle.error ?? unlinkGoogle.error ?? (connected ? identitiesError : null);

  // Disconnect needs the identity itself, so it waits for the list; connect
  // doesn't. Either way the row's copy comes from the session and never flickers.
  const disabled = busy || (connected && (lockedIn || !googleIdentity));
  const note = lockedIn ? t("integrations.error.lastIdentity") : null;

  return (
    <>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
        <GoogleIcon className="size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("integrations.google")}</p>
          <p className="truncate text-xs text-muted-foreground">
            {connected
              ? t("integrations.connectedAs", {
                  // The Google address, which need not be the one the account
                  // signs in with; its own address is the honest fallback.
                  email: identityEmailOf(googleIdentity) || (session?.user.email ?? ""),
                })
              : t("integrations.notConnected")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-describedby={note ? NOTE_ID : undefined}
          onClick={() => {
            if (connected) {
              if (googleIdentity) unlinkGoogle.mutate(googleIdentity);
            } else {
              linkGoogle.mutate();
            }
          }}
        >
          {connected ? t("integrations.disconnect") : t("integrations.connect")}
        </Button>
      </div>
      {note ? (
        <p id={NOTE_ID} className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {note}
        </p>
      ) : null}
      {/* Inline and persistent, like the Account section: a toast would take
          "linking is turned off for this project" away before it's understood. */}
      {error ? (
        <p className="mt-2 text-xs leading-relaxed text-destructive">
          {t(`integrations.error.${integrationErrorKey(error)}`)}
        </p>
      ) : null}
    </>
  );
}

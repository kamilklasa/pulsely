import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, TerminalSquare } from "lucide-react";
import { Button, Input } from "@/shared/ui";
import { useCreateIngestToken, useIngestTokens, useRevokeIngestToken } from "./ingest-token.data";
import { ingestApiUrl, ingestTokenErrorKey, wakatimeConfigSnippet } from "./ingest-token.utils";
import type { CreatedIngestToken, IngestToken } from "./ingest-token.types";

const CFG_PATH = "~/.wakatime.cfg";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          // Long enough to read as an acknowledgement, short enough that the
          // button is back to its real affordance before it's wanted again.
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function useFormatDate() {
  const { i18n } = useTranslation();
  return (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(iso));
}

// The panel that exists for exactly one render of the user's session: the only
// moment the plaintext key is in the app at all. It leaves when dismissed and
// there is no way back to it, which is why the config block is here rather than
// alongside the key list — the snippet is only useful while the key is on screen.
function NewKeyPanel({
  created,
  onDismiss,
}: {
  created: CreatedIngestToken;
  onDismiss: () => void;
}) {
  const { t } = useTranslation("settings");
  const snippet = wakatimeConfigSnippet(
    ingestApiUrl(import.meta.env.VITE_SUPABASE_URL),
    created.plaintext,
  );

  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-3">
      <p className="text-sm font-medium">{t("integrations.wakatime.newKey.title")}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {t("integrations.wakatime.newKey.shownOnce")}
      </p>

      <div className="mt-2.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border/60 bg-background px-2.5 py-2 font-mono text-xs">
          {created.plaintext}
        </code>
        <CopyButton value={created.plaintext} label={t("integrations.wakatime.copyKey")} />
      </div>

      <p className="mt-3 text-xs font-medium text-muted-foreground">
        {t("integrations.wakatime.newKey.cfgHint", { path: CFG_PATH })}
      </p>
      <div className="mt-1.5 flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border/60 bg-background px-2.5 py-2 font-mono text-xs leading-relaxed">
          {snippet}
        </pre>
        <CopyButton value={snippet} label={t("integrations.wakatime.copyConfig")} />
      </div>

      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onDismiss}>
        {t("integrations.wakatime.newKey.done")}
      </Button>
    </div>
  );
}

function KeyRow({ token }: { token: IngestToken }) {
  const { t } = useTranslation("settings");
  const formatDate = useFormatDate();
  const revoke = useRevokeIngestToken();

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{token.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {t("integrations.wakatime.created", { date: formatDate(token.created_at) })}
          {" · "}
          {token.last_used_at
            ? t("integrations.wakatime.lastUsed", { date: formatDate(token.last_used_at) })
            : t("integrations.wakatime.neverUsed")}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate(token.id)}
      >
        {t("integrations.wakatime.revoke")}
      </Button>
    </div>
  );
}

export function WakatimeIntegrationRow() {
  const { t } = useTranslation("settings");
  const { data: tokens } = useIngestTokens();
  const createToken = useCreateIngestToken();

  const [label, setLabel] = useState("");
  const created = createToken.data;

  const keyCount = tokens?.length ?? 0;
  const error = createToken.error;

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5">
        <TerminalSquare className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("integrations.wakatime.title")}</p>
          <p className="truncate text-xs text-muted-foreground">
            {keyCount > 0
              ? t("integrations.wakatime.keyCount", { count: keyCount })
              : t("integrations.wakatime.noKeys")}
          </p>
        </div>
      </div>

      {tokens?.map((token) => (
        <KeyRow key={token.id} token={token} />
      ))}

      {created ? (
        <NewKeyPanel
          created={created}
          onDismiss={() => {
            // The only copy of the plaintext lives in the mutation's result, so
            // resetting it is what actually makes "shown once" true rather than
            // just hiding the panel.
            createToken.reset();
            setLabel("");
          }}
        />
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            createToken.mutate(label.trim());
          }}
        >
          <Input
            aria-label={t("integrations.wakatime.labelPlaceholder")}
            placeholder={t("integrations.wakatime.labelPlaceholder")}
            value={label}
            onChange={(event) => {
              if (createToken.isError) createToken.reset();
              setLabel(event.target.value);
            }}
            disabled={createToken.isPending}
          />
          {/* A key nobody can tell apart from the next one cannot be revoked with
              any confidence, so the label is required rather than defaulted. */}
          <Button type="submit" size="lg" disabled={!label.trim() || createToken.isPending}>
            {t("integrations.wakatime.generate")}
          </Button>
        </form>
      )}

      {error ? (
        <p className="text-xs leading-relaxed text-destructive">
          {t(`integrations.wakatime.error.${ingestTokenErrorKey(error)}`)}
        </p>
      ) : null}
    </div>
  );
}

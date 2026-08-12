import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { useSignOut } from "@/features/sign-out";
import { setLocale, useLocale, type Locale } from "@/shared/i18n";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPopup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  GbFlagIcon,
  PlFlagIcon,
} from "@/shared/ui";

export function AccountMenu() {
  const { t } = useTranslation("common");
  const { t: tAccountMenu } = useTranslation("account-menu");
  const { t: tSignOut } = useTranslation("sign-out");
  const { session } = useSession();
  const locale = useLocale();
  const signOut = useSignOut();
  const email = session?.user.email ?? "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={tAccountMenu("trigger")}
        className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {email.charAt(0).toUpperCase()}
      </DropdownMenuTrigger>
      <DropdownMenuPopup>
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => setLocale(value as Locale)}
        >
          <DropdownMenuRadioItem value="en">
            <GbFlagIcon className="size-4" />
            {t("language.en")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="pl">
            <PlFlagIcon className="size-4" />
            {t("language.pl")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut.mutate()}>
          <LogOut />
          {tSignOut("signOut")}
        </DropdownMenuItem>
      </DropdownMenuPopup>
    </DropdownMenu>
  );
}

import { useStore } from "@tanstack/react-store";
import { localeStore } from "./locale.store";
import type { Locale } from "./i18n.types";

export function useLocale(): Locale {
  return useStore(localeStore, (state) => state);
}

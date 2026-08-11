import { useSelector } from "@tanstack/react-store";
import { localeStore } from "./locale.store";
import type { Locale } from "./i18n.types";

export function useLocale(): Locale {
  return useSelector(localeStore, (state) => state);
}

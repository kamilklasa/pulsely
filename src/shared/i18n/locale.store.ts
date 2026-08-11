import { Store } from "@tanstack/store";
import { i18n } from "./i18n.config";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "./i18n.types";

function toLocale(lng: string | undefined): Locale {
  const candidate = lng?.split("-")[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate ?? "")
    ? (candidate as Locale)
    : DEFAULT_LOCALE;
}

// Single source of truth for the current locale: the language switcher
// writes here, and components read it via `useStore` rather than reaching
// into the i18next instance directly. `resolvedLanguage` reflects whatever
// LanguageDetector picked (localStorage, then the browser) by the time this
// module evaluates — see i18n.config.ts for why that's synchronous.
export const localeStore = new Store<Locale>(toLocale(i18n.resolvedLanguage ?? i18n.language));

// Keep i18next's own `changeLanguage` in sync with the store, rather than
// having components query i18next directly.
localeStore.subscribe(() => {
  const next = localeStore.state;
  if (toLocale(i18n.resolvedLanguage) !== next) {
    void i18n.changeLanguage(next);
  }
});

export function setLocale(locale: Locale): void {
  localeStore.setState(() => locale);
}

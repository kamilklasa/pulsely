import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import boardEn from "./locales/en/board.json";
import commonEn from "./locales/en/common.json";
import signInEn from "./locales/en/sign-in.json";
import signOutEn from "./locales/en/sign-out.json";
import boardPl from "./locales/pl/board.json";
import commonPl from "./locales/pl/common.json";
import signInPl from "./locales/pl/sign-in.json";
import signOutPl from "./locales/pl/sign-out.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "./i18n.utils";

// Namespaced per FSD slice — "common" for cross-cutting strings (e.g. the
// language switcher), one namespace per feature/page slice (e.g. "sign-in").
export const resources = {
  en: { common: commonEn, "sign-in": signInEn, board: boardEn, "sign-out": signOutEn },
  pl: { common: commonPl, "sign-in": signInPl, board: boardPl, "sign-out": signOutPl },
} as const;

export const defaultNS = "common" as const;

// Resources are bundled statically (no HTTP backend), so init() — and the
// LanguageDetector's localStorage/navigator lookups — resolve synchronously;
// `i18n.t()` is safe to call immediately after this module evaluates.
void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
  resources,
  supportedLngs: SUPPORTED_LOCALES,
  fallbackLng: DEFAULT_LOCALE,
  defaultNS,
  load: "languageOnly",
  detection: {
    order: ["localStorage", "navigator"],
    caches: ["localStorage"],
    lookupLocalStorage: "pulsely:locale",
  },
  interpolation: {
    escapeValue: false,
  },
});

export { i18next as i18n };

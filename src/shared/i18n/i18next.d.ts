import "i18next";
import type { defaultNS, resources } from "./i18n.config";

// Type-checks every t() call against the "en" catalog shape — a typo'd or
// missing key fails `tsc --noEmit`.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)["en"];
  }
}

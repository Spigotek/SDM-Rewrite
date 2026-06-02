/**
 * Lazy i18n hydration — invoked after `createRoot().render()` returns.
 *
 * Imports from `@sdm/i18n` synchronously here, but because this module is only
 * reachable via a dynamic `import()` from `main.tsx`, Vite splits it into its
 * own chunk. The transitive dependency on `vendor-i18n` (i18next +
 * react-i18next + intl-messageformat + @formatjs/icu-messageformat-parser) is
 * pulled out of the entry chunk and only fetched after first paint.
 *
 * On success, calls `promoteToHydrated()` on the portal shim — every mounted
 * component that subscribed via `useSyncExternalStore` re-renders, and `t()`
 * starts proxying to the real `i18next.t()` (full ICU formatting + plurals).
 *
 * On failure (network blip mid-bootstrap), we leave the shim in `critical`
 * state — the static dictionary covers every FCP-reachable key, so the user
 * still sees real Slovak/English text. The error is logged to the console
 * for dev visibility and silently swallowed in prod.
 */

// `@sdm/i18n` here resolves to the workspace package, NOT the shim — this file
// lives outside `src/lib/i18n-portal.ts`'s alias self-reference concern. The
// Vite alias keyed on `@sdm/i18n` redirects to `i18n-portal`, which re-exports
// `bootstrapI18n` from the real package's source. The end result is identical.
import { bootstrapI18n } from "@sdm/i18n";

import { promoteToHydrated } from "../lib/i18n-shim";

export async function hydrateI18n(): Promise<void> {
  try {
    const instance = await bootstrapI18n({ app: "portal" });
    promoteToHydrated(instance);
  } catch (err) {
    // Static-dict fallback already covers every FCP key — leaving the shim
    // in `critical` state is a degraded but functional outcome.
    if (import.meta.env.DEV) {
      console.warn("[portal] i18n hydrate failed — staying on critical dict", err);
    }
  }
}

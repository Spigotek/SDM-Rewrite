/**
 * Ambient module declaration for the I.0 Resolution 4 alias.
 *
 * `apps/portal/vite.config.ts` aliases `@sdm/i18n-real` to the underlying
 * `packages/i18n/src/index.ts` so `i18n-portal.ts` can re-export from the
 * real package without hitting the alias on `@sdm/i18n` (which would loop).
 *
 * TypeScript has no path mapping for `@sdm/i18n-real` (`paths` would pull
 * external files into portal's `rootDir` and break compilation), so this
 * ambient module simply re-exports the type surface of `@sdm/i18n` —
 * matching what the Vite alias resolves to at runtime.
 */
declare module "@sdm/i18n-real" {
  export * from "@sdm/i18n";
}

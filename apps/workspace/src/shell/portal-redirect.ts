/**
 * Resolve the portal app origin a requester session must be redirected to.
 *
 * The workspace SPA runs on :89 and the portal on :88 behind the same
 * front-door host. An explicit `portalOrigin` from `/config` always wins;
 * otherwise we derive it from the current origin by targeting :88 (swapping a
 * :89 workspace port, and defaulting any other/empty port to :88 too).
 */
export function resolvePortalOrigin(
  portalOrigin: string | undefined,
  currentOrigin: { protocol: string; hostname: string; port: string },
): string {
  if (portalOrigin && portalOrigin.length > 0) {
    return portalOrigin.replace(/\/+$/, "");
  }
  return `${currentOrigin.protocol}//${currentOrigin.hostname}:88`;
}

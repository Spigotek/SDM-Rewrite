import type { TenantId } from "@sdm/domain";

/**
 * Deterministic tenant-id → color palette for the cross-tenant calendar
 * overlay. The palette is intentionally small (4 hues) — covering the
 * single-digit-SP-scope typical of v1.0 cockpits. The hash collapses to a
 * stable index so the same tenant always paints the same color across
 * sessions; CSS custom properties supply theme-aware values so the palette
 * adapts to dark/light without a JS-side switch.
 */

const PALETTE: readonly string[] = [
  "var(--color-tenant-overlay-1, #89b4fa)",
  "var(--color-tenant-overlay-2, #f9e2af)",
  "var(--color-tenant-overlay-3, #a6e3a1)",
  "var(--color-tenant-overlay-4, #f38ba8)",
];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function colorForTenant(tenantId: TenantId | string): string {
  const idx = hash(String(tenantId)) % PALETTE.length;
  return PALETTE[idx] ?? PALETTE[0]!;
}

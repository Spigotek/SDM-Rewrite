/**
 * `data-component` attribute helper — every primitive exposes a stable
 * kebab-case identifier so e2e tests and debug snapshots can locate elements
 * without coupling to CSS class names. See `components.md` intro for the rule.
 */

export interface DataComponentAttr {
  "data-component": string;
}

export function dataComponent(name: string): DataComponentAttr {
  return { "data-component": name };
}

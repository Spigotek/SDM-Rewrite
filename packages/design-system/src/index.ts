/**
 * `@sdm/design-system` — public API.
 *
 * - Primitives are re-exported individually so consumers can tree-shake.
 * - Tokens (`tokens.css`, `reset.css`, `fonts.css`) are exposed via `package.json#exports`
 *   and imported directly by SPA entry points; they are not bundled through this barrel.
 * - Theme helpers (`applyTheme`, `resolveTheme`, `FOUC_SCRIPT`) ship as ESM.
 */

export const PACKAGE_NAME = "@sdm/design-system";

export * from "./primitives/Icon";
export * from "./primitives/Button";
export * from "./primitives/IconButton";
export * from "./primitives/Link";
export * from "./primitives/Badge";
export * from "./primitives/StatusBadge";
export * from "./primitives/PriorityBadge";
export * from "./primitives/Card";
export * from "./primitives/TextField";
export * from "./primitives/TextArea";
export * from "./primitives/Select";
export * from "./primitives/Checkbox";

export {
  applyTheme,
  resolveTheme,
  persistThemeChoice,
  FOUC_SCRIPT,
  THEME_STORAGE_KEY,
} from "./tokens/theme";
export type { ThemeName, ThemeChoice } from "./tokens/theme";

export { cn } from "./utils/cn";
export type { ClassValue } from "./utils/cn";
export { dataComponent } from "./utils/data-component";
export type { DataComponentAttr } from "./utils/data-component";

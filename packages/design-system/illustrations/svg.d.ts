/**
 * Ambient declarations for `*.svg?react` imports inside the design-system
 * package.
 *
 * `vite-plugin-svgr` ships its own `client.d.ts` (under `vite-plugin-svgr` in
 * each app's node_modules) declaring this exact module shape — but the DS
 * package is consumed without a Vite config of its own and is typechecked by
 * a bare `tsc` invocation. Mirroring the upstream shape here lets `tsc` see
 * the React-component default export when it walks `illustrations/index.ts`.
 */
declare module "*.svg?react" {
  import type { FunctionComponent, SVGProps } from "react";

  const ReactComponent: FunctionComponent<
    SVGProps<SVGSVGElement> & {
      title?: string;
      titleId?: string;
      desc?: string;
      descId?: string;
    }
  >;
  export default ReactComponent;
}

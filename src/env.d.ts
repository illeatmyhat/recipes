/// <reference types="astro/client" />

declare namespace App {
  // The v3 method components read their recipe through the per-render locals
  // object — see src/lib/v3/methodContext.ts.
  interface Locals extends import('./lib/v3/methodContext').MethodContextLocals {}
}

// Site-level locale catalogs (src/locales/<locale>.yaml) import as flat
// string maps via @rollup/plugin-yaml — see src/lib/i18n.ts.
declare module '*.yaml' {
  const data: Record<string, string>;
  export default data;
}

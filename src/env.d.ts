/// <reference types="astro/client" />

declare namespace App {
  // The v3 method components read their recipe through the per-render locals
  // object — see src/lib/v3/methodContext.ts.
  interface Locals extends import('./lib/v3/methodContext').MethodContextLocals {}
}

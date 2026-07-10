/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/** Versión de la app derivada del commit (ver scripts/app-version.mjs). */
interface AppVersion {
  /** Versión semver base (package.json). */
  version: string
  /** Cadena legible: tag `git describe` o `vX.Y.Z+<nºcommits>.<hash>`. */
  flavor: string
  /** Hash corto del commit. */
  commit: string
  /** Nº total de commits (build monotónico). */
  commitCount: number
  /** Rama del build. */
  branch: string
  /** Salida cruda de `git describe --tags --always --dirty`. */
  describe: string
  /** Fecha ISO del commit HEAD. */
  commitDate: string
  /** Fecha ISO del build. */
  buildDate: string
  /** true si el árbol de trabajo tenía cambios sin commitear al construir. */
  dirty: boolean
}

/** Constante inyectada por Vite (`define`) en build/dev. */
declare const __APP_VERSION__: AppVersion

import { resolve } from 'node:path'
import { build } from 'vite'

/**
 * Sandboxed Electron preloads cannot require local Rollup chunks. Build the
 * passive bridge independently so both preload entrypoints remain complete,
 * self-contained CJS files while retaining boundary validation.
 */
await build({
  configFile: false,
  root: process.cwd(),
  ssr: { noExternal: true },
  build: {
    emptyOutDir: false,
    outDir: resolve('out/preload'),
    ssr: resolve('src/preload/passive.ts'),
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: 'passive.js',
        inlineDynamicImports: true
      }
    }
  }
})

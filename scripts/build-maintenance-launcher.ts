import { resolve } from 'node:path'
import { build } from 'vite'

// Bundled CJS runs under the retained AppImage's Node mode without installed tools.
await build({
  configFile: false,
  root: process.cwd(),
  ssr: { noExternal: true },
  build: {
    emptyOutDir: false,
    outDir: resolve('out/maintenance'),
    ssr: resolve('src/main/maintenance-launcher/entry.ts'),
    rollupOptions: {
      output: {
        format: 'cjs',
        entryFileNames: 'start.cjs',
        inlineDynamicImports: true
      }
    }
  }
})

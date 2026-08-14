import { defineConfig } from 'electron-vite'
import { resolve } from 'node:path'

const qualificationBuild =
  process.env['SALT_MARCHER_BUILD_TARGET'] === 'qualification'

export default defineConfig({
  main: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          utility: resolve('src/utility/index.ts')
        }
      }
    }
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts')
        },
        output: { format: 'cjs', entryFileNames: '[name].js' }
      }
    }
  },
  renderer: {
    build: {
      manifest: true,
      // Renderer budgets measure emitted bytes. Electron-vite leaves renderer
      // chunks readable unless minification is explicit, so keep production
      // delivery and the ratcheted architecture budget aligned.
      minify: 'esbuild',
      rollupOptions: {
        input: {
          ...(qualificationBuild
            ? { qualification: resolve('src/renderer/qualification.html') }
            : {
                index: resolve('src/renderer/index.html'),
                passive: resolve('src/renderer/passive.html')
              })
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    }
  }
})

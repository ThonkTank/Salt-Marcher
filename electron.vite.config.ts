import { defineConfig } from 'electron-vite'
import { cpSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'

const require = createRequire(import.meta.url)
const babylonDirectory = dirname(
  require.resolve('@babylonjs/core/package.json')
)

function copyBabylonRuntime(): Plugin {
  return {
    name: 'copy-babylon-runtime',
    closeBundle() {
      const destination = resolve('out/renderer/vendor/babylon')
      rmSync(destination, { recursive: true, force: true })
      cpSync(babylonDirectory, destination, { recursive: true })
    }
  }
}

export default defineConfig({
  main: {
    build: {
      externalizeDeps: true,
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          utility: resolve('src/main/core-process/utility.ts')
        }
      }
    }
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].js' } }
    }
  },
  renderer: {
    plugins: [copyBabylonRuntime()],
    build: {
      rollupOptions: {
        external: (id) => id.startsWith('@babylonjs/core/')
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

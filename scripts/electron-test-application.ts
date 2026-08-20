import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'

const packageRequire = createRequire(import.meta.url)

export function electronTestApplication(
  appEntryPoint: string,
  appArgs: readonly string[]
): Readonly<{ appBinaryPath: string; appArgs: string[] }> {
  const resolved = packageRequire('electron') as unknown
  if (typeof resolved !== 'string' || !existsSync(resolved))
    throw new Error('The Electron package did not resolve to an executable.')
  return {
    appBinaryPath: realpathSync(resolved),
    appArgs: [`--app=${appEntryPoint}`, ...appArgs]
  }
}

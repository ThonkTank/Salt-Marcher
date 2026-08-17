import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const packageRequire = createRequire(import.meta.url)

export const tsxEntry = packageRequire.resolve('tsx/cli')
export const electronViteEntry = join(
  dirname(packageRequire.resolve('electron-vite/package.json')),
  'bin',
  'electron-vite.js'
)

export function runNodeCli(
  entry: string,
  arguments_: readonly string[],
  extraEnvironment: Readonly<Record<string, string>> = {}
): void {
  const result = spawnSync(process.execPath, [entry, ...arguments_], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, ...extraEnvironment }
  })
  if (result.error) throw result.error
  if (result.status !== 0)
    throw new Error(
      `${process.execPath} ${entry} ${arguments_.join(' ')} failed with ${result.status}`
    )
}

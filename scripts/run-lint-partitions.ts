import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { lintPartitions } from './lint-partitions.js'

for (const partition of lintPartitions) {
  console.log(`\nLint: ${partition.name}`)
  const status = await runEslint(partition.targets)
  if (status !== 0) {
    process.exitCode = status
    break
  }
}

function runEslint(targets: readonly string[]): Promise<number> {
  return new Promise((resolve) => {
    const executable = join(
      process.cwd(),
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'eslint.cmd' : 'eslint'
    )
    const child = spawn(executable, [...targets, '--max-warnings=0'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_OPTIONS: withHeapLimit(process.env['NODE_OPTIONS'])
      },
      stdio: 'inherit'
    })
    child.once('error', (error) => {
      console.error(error)
      resolve(1)
    })
    child.once('exit', (code) => resolve(code ?? 1))
  })
}

function withHeapLimit(current: string | undefined): string {
  const withoutOldLimit = (current ?? '')
    .split(/\s+/)
    .filter((entry) => entry && !entry.startsWith('--max-old-space-size='))
  return [...withoutOldLimit, '--max-old-space-size=2048'].join(' ')
}

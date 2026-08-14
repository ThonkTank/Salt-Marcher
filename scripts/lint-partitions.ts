export type LintPartition = Readonly<{
  name: string
  targets: readonly string[]
}>

export const lintPartitions = [
  {
    name: 'core',
    targets: ['src/shared', 'src/core', 'src/utility']
  },
  {
    name: 'electron-tooling',
    targets: [
      'src/main',
      'src/preload',
      'scripts',
      'electron.vite.config.ts',
      'vitest.config.ts',
      'wdio.conf.ts',
      'wdio.passive.conf.ts'
    ]
  },
  {
    name: 'renderer',
    targets: ['src/renderer']
  },
  {
    name: 'tests',
    targets: ['tests']
  }
] as const satisfies readonly LintPartition[]

export function lintPartitionsFor(path: string): readonly string[] {
  return lintPartitions
    .filter((partition) =>
      partition.targets.some(
        (target) => path === target || path.startsWith(`${target}/`)
      )
    )
    .map((partition) => partition.name)
}

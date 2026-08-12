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

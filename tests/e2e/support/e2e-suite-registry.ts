type E2eSuiteRegistration = Readonly<{
  name: string
  spec: `./tests/e2e/${string}.e2e.ts`
  fixture: `v${number}/${string}`
}>

export const e2eSuiteRegistry = [
  {
    name: 'workspaces',
    spec: './tests/e2e/workspace-isolation.e2e.ts',
    fixture: 'v1/empty-installation'
  },
  {
    name: 'create',
    spec: './tests/e2e/campaign-walking.e2e.ts',
    fixture: 'v1/empty-installation'
  },
  {
    name: 'hexLocation',
    spec: './tests/e2e/hex-location-workflow.e2e.ts',
    fixture: 'v1/empty-installation'
  },
  {
    name: 'restart',
    spec: './tests/e2e/campaign-restart.e2e.ts',
    fixture: 'v1/editor-data'
  },
  {
    name: 'dialogs',
    spec: './tests/e2e/dialog-architecture.e2e.ts',
    fixture: 'v1/empty-installation'
  },
  {
    name: 'sessionGeneration',
    spec: './tests/e2e/session-generation.e2e.ts',
    fixture: 'v1/empty-installation'
  },
  {
    name: 'loot',
    spec: './tests/e2e/session-loot.e2e.ts',
    fixture: 'v1/empty-installation'
  },
  {
    name: 'groupLoot',
    spec: './tests/e2e/group-loot.e2e.ts',
    fixture: 'v3/group-loot'
  },
  {
    name: 'travel',
    spec: './tests/e2e/session-travel.e2e.ts',
    fixture: 'v2/travel-scenario'
  }
] as const satisfies readonly E2eSuiteRegistration[]

export type E2eSuiteName = (typeof e2eSuiteRegistry)[number]['name']

export function isE2eSuiteName(value: string): value is E2eSuiteName {
  return e2eSuiteRegistry.some((suite) => suite.name === value)
}

export function e2eSuite(name: E2eSuiteName) {
  return e2eSuiteRegistry.find((suite) => suite.name === name)!
}

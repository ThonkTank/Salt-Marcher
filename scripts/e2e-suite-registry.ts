export const e2eSuiteTypes = ['functional', 'visual'] as const
export type E2eSuiteType = (typeof e2eSuiteTypes)[number]

export const functionalE2eCiShards = [
  'campaign-workspaces',
  'hex-npc-restart',
  'dialogs-generation-loot',
  'group-loot-travel'
] as const
export type FunctionalE2eCiShard = (typeof functionalE2eCiShards)[number]

export const visualE2eCiShards = [
  'goldens-campaign',
  'goldens-dialog-travel-loot',
  'goldens-world-create'
] as const
export type VisualE2eCiShard = (typeof visualE2eCiShards)[number]

export type E2eSuiteRegistration = Readonly<{
  name: string
  spec: `./tests/e2e/${string}.e2e.ts`
  fixture: `v${number}/${string}`
  types: readonly E2eSuiteType[]
  ci: Readonly<{
    functional: Readonly<{
      shard: FunctionalE2eCiShard
      measuredSeconds: number
    }>
    visual?: Readonly<{
      shard: VisualE2eCiShard
      measuredSeconds: number
    }>
  }>
}>

export const e2eSuiteRegistry = [
  {
    name: 'workspaces',
    spec: './tests/e2e/workspace-isolation.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional'],
    ci: {
      functional: { shard: 'campaign-workspaces', measuredSeconds: 80 }
    }
  },
  {
    name: 'campaignCreate',
    spec: './tests/e2e/campaign-create.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional', 'visual'],
    ci: {
      functional: { shard: 'campaign-workspaces', measuredSeconds: 82 },
      visual: { shard: 'goldens-world-create', measuredSeconds: 90 }
    }
  },
  {
    name: 'campaignReconciliation',
    spec: './tests/e2e/campaign-reconciliation.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional'],
    ci: {
      functional: { shard: 'campaign-workspaces', measuredSeconds: 95 }
    }
  },
  {
    name: 'campaignHexMap',
    spec: './tests/e2e/campaign-hex-map.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional', 'visual'],
    ci: {
      functional: { shard: 'campaign-workspaces', measuredSeconds: 79 },
      visual: { shard: 'goldens-campaign', measuredSeconds: 81 }
    }
  },
  {
    name: 'campaignCombat',
    spec: './tests/e2e/campaign-combat.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional', 'visual'],
    ci: {
      functional: { shard: 'campaign-workspaces', measuredSeconds: 93 },
      visual: { shard: 'goldens-campaign', measuredSeconds: 100 }
    }
  },
  {
    name: 'campaignPseudoLocale',
    spec: './tests/e2e/campaign-pseudo-locale.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional'],
    ci: {
      functional: { shard: 'campaign-workspaces', measuredSeconds: 74 }
    }
  },
  {
    name: 'campaignQualification',
    spec: './tests/e2e/campaign-qualification.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional'],
    ci: {
      functional: { shard: 'hex-npc-restart', measuredSeconds: 250 }
    }
  },
  {
    name: 'hexLocation',
    spec: './tests/e2e/hex-location-workflow.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional', 'visual'],
    ci: {
      functional: { shard: 'hex-npc-restart', measuredSeconds: 91 },
      visual: { shard: 'goldens-world-create', measuredSeconds: 92 }
    }
  },
  {
    name: 'npcCatalog',
    spec: './tests/e2e/npc-catalog.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional'],
    ci: {
      functional: { shard: 'hex-npc-restart', measuredSeconds: 80 }
    }
  },
  {
    name: 'restart',
    spec: './tests/e2e/campaign-restart.e2e.ts',
    fixture: 'v1/editor-data',
    types: ['functional'],
    ci: {
      functional: { shard: 'hex-npc-restart', measuredSeconds: 73 }
    }
  },
  {
    name: 'dialogs',
    spec: './tests/e2e/dialog-architecture.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional', 'visual'],
    ci: {
      functional: { shard: 'dialogs-generation-loot', measuredSeconds: 99 },
      visual: {
        shard: 'goldens-dialog-travel-loot',
        measuredSeconds: 96
      }
    }
  },
  {
    name: 'sessionGeneration',
    spec: './tests/e2e/session-generation.e2e.ts',
    fixture: 'v1/empty-installation',
    types: ['functional'],
    ci: {
      functional: { shard: 'dialogs-generation-loot', measuredSeconds: 89 }
    }
  },
  {
    name: 'loot',
    spec: './tests/e2e/session-loot.e2e.ts',
    fixture: 'v4/loot-distribution',
    types: ['functional'],
    ci: {
      functional: { shard: 'dialogs-generation-loot', measuredSeconds: 76 }
    }
  },
  {
    name: 'groupLoot',
    spec: './tests/e2e/group-loot.e2e.ts',
    fixture: 'v3/group-loot',
    types: ['functional', 'visual'],
    ci: {
      functional: { shard: 'group-loot-travel', measuredSeconds: 82 },
      visual: {
        shard: 'goldens-dialog-travel-loot',
        measuredSeconds: 77
      }
    }
  },
  {
    name: 'groupLootCommit',
    spec: './tests/e2e/group-loot-commit.e2e.ts',
    fixture: 'v3/group-loot',
    types: ['functional'],
    ci: {
      functional: { shard: 'group-loot-travel', measuredSeconds: 75 }
    }
  },
  {
    name: 'travel',
    spec: './tests/e2e/session-travel.e2e.ts',
    fixture: 'v2/travel-scenario',
    types: ['functional', 'visual'],
    ci: {
      functional: { shard: 'group-loot-travel', measuredSeconds: 79 },
      visual: {
        shard: 'goldens-dialog-travel-loot',
        measuredSeconds: 82
      }
    }
  }
] as const satisfies readonly E2eSuiteRegistration[]

export type E2eSuiteName = (typeof e2eSuiteRegistry)[number]['name']

export function isE2eSuiteName(value: string): value is E2eSuiteName {
  return e2eSuiteRegistry.some((suite) => suite.name === value)
}

export function e2eSuite(name: E2eSuiteName) {
  return e2eSuiteRegistry.find((suite) => suite.name === name)!
}

export function e2eSuiteHasType(
  suite: E2eSuiteRegistration,
  type: E2eSuiteType
): boolean {
  return suite.types.includes(type)
}

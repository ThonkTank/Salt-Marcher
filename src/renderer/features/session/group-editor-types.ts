import type {
  Treasure,
  GroupLootBalance
} from '../../../shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../../shared/contracts/session-generation.js'
import type { CapabilityIssue } from '../../../shared/errors/capability-issue.js'
import type { GroupLootDraftHistory } from '../loot/group-loot-draft.js'
import type { GroupDraftState } from './group-draft.js'
export type GroupDraftLootPhase =
  'idle' | 'generating' | 'ready' | 'committing' | 'error'
export type GroupManagerLootState = Readonly<{
  persisted?: Treasure | null
  run: GroupRewardGeneratedRun | null
  history: GroupLootDraftHistory | null
  committedSignature: string | null
  seed: number | null
  phase: GroupDraftLootPhase
  error: string
  issues: readonly CapabilityIssue[]
}>

export type GroupDraftSession = Readonly<{
  budgetSeed?: number
  lootSelection?: string
  lootCache?: Readonly<Record<string, GroupManagerLootState>>
  lootLoaded?: boolean
  balance?: GroupLootBalance | null
  balanceError?: string
  includeLoot?: boolean
  sourceRevision: number | null
  group: GroupDraftState
  loot: GroupManagerLootState
  externalConflict: boolean
}>

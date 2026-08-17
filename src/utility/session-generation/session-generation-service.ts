import type Database from 'better-sqlite3'
import { GeneratedRunStore } from '../../core/session-generation/generated-run-store.js'
import {
  generateGroupRewardDraftResult,
  generateSessionRunDraft
} from '../../core/session-generation/loot-engine.js'
import type { EncounterEntropy } from '../../core/session-generation/deterministic-order.js'
import type {
  GeneratedRun,
  GroupRewardGenerationInput,
  GroupRewardGenerationResult,
  SessionGenerationRunInput,
  SessionGenerationRunResult
} from '../../shared/contracts/session-generation.js'
import {
  groupRewardGeneratedRunSchema,
  sessionGeneratedRunSchema
} from '../../shared/contracts/session-generation.js'
import { uuidv7 } from '../../shared/ids/uuidv7.js'
import { CapabilityError } from '../../shared/errors/capability-error.js'
import {
  CatalogProviderError,
  type BundledEncounterCatalogProvider
} from './catalog-provider.js'
import {
  systemGeneratorPresetId,
  type GeneratorPresetConfigV3
} from '../../shared/contracts/generator-presets.js'
import { defaultGeneratorConfig } from '../../shared/generator/system-generator-preset.js'
import {
  groupRewardRunOriginFingerprint,
  sessionRunOriginFingerprint
} from '../../core/session-generation/run-origin.js'

export class SessionGenerationService {
  constructor(
    private readonly catalogProvider: Pick<
      BundledEncounterCatalogProvider,
      'loadFull'
    >,
    private readonly entropy: EncounterEntropy,
    private readonly preset: () => {
      id: string
      revision: number
      config: GeneratorPresetConfigV3
    } = () => ({
      id: systemGeneratorPresetId,
      revision: 0,
      config: defaultGeneratorConfig
    }),
    private readonly activeDatabase?: () => Database.Database,
    private readonly clock: () => Date = () => new Date()
  ) {}

  generate(input: SessionGenerationRunInput): SessionGenerationRunResult {
    try {
      const catalog = this.catalogProvider.loadFull()
      const preset = this.preset()
      const runId = uuidv7()
      const result = generateSessionRunDraft(
        input,
        catalog,
        this.entropy,
        preset,
        runId
      )
      if (result.status !== 'success') return result
      if (!this.activeDatabase)
        throw new Error(
          'A campaign database is required to persist generated runs'
        )
      const originFingerprint = sessionRunOriginFingerprint({
        encounterEngineVersion: result.draft.engineVersion,
        rewardEngineVersion: result.draft.rewardEngineVersion,
        catalogContentHash: result.draft.catalogContentHash,
        generatorPreset: result.draft.generatorPreset,
        input: result.draft.input
      })
      const store = new GeneratedRunStore(this.activeDatabase())
      const existing = store.findByFingerprint(originFingerprint)
      if (existing) {
        if (existing.runKind !== 'session')
          throw new Error(
            'Session generation origin resolved to another run kind'
          )
        return deepFreeze({
          status: 'success',
          run: sessionGeneratedRunSchema.parse(existing)
        })
      }
      const run = sessionGeneratedRunSchema.parse({
        ...result.draft,
        id: runId,
        originFingerprint,
        generatedAt: this.clock().toISOString()
      })
      return deepFreeze({ status: 'success', run: store.save(run) })
    } catch (error) {
      if (error instanceof CatalogProviderError)
        return deepFreeze({
          status: 'catalog_error',
          issues: [{ code: error.code, parameters: {} }]
        })
      throw error
    }
  }

  readRun(runId: string): GeneratedRun {
    if (!this.activeDatabase)
      throw new Error('A campaign database is required to read generated runs')
    const run = new GeneratedRunStore(this.activeDatabase()).read(runId)
    if (!run) throw new CapabilityError('not_found', false)
    return run
  }

  generateGroupReward(
    input: GroupRewardGenerationInput
  ): GroupRewardGenerationResult {
    if (!this.activeDatabase)
      throw new Error(
        'A campaign database is required to persist generated runs'
      )
    const catalog = this.catalogProvider.loadFull()
    const preset = this.preset()
    const runId = uuidv7()
    const draftResult = generateGroupRewardDraftResult(
      input,
      catalog,
      this.entropy,
      preset,
      runId
    )
    if (draftResult.status !== 'success') return draftResult
    const draft = draftResult.draft
    const originFingerprint = groupRewardRunOriginFingerprint({
      rewardEngineVersion: draft.rewardEngineVersion,
      catalogContentHash: draft.catalogContentHash,
      generatorPreset: draft.generatorPreset,
      input: draft.input
    })
    const store = new GeneratedRunStore(this.activeDatabase())
    const existing = store.findByFingerprint(originFingerprint)
    if (existing) {
      if (existing.runKind !== 'group_reward')
        throw new Error('Group reward origin resolved to another run kind')
      return deepFreeze({
        status: 'success',
        run: groupRewardGeneratedRunSchema.parse(existing)
      })
    }
    return deepFreeze({
      status: 'success',
      run: store.save(
        groupRewardGeneratedRunSchema.parse({
          ...draft,
          id: runId,
          originFingerprint,
          generatedAt: this.clock().toISOString()
        })
      )
    })
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child)
  }
  return value
}

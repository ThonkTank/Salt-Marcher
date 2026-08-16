import type {
  GroupRewardGenerationInput,
  SessionGenerationEncounterInput
} from '../../shared/contracts/session-generation.js'
import { fingerprint } from '../fingerprint.js'

export type SessionRunOrigin = Readonly<{
  encounterEngineVersion: string
  rewardEngineVersion: string
  catalogContentHash: string
  generatorPreset: Readonly<{
    id: string
    revision: number
    configHash: string
  }>
  input: SessionGenerationEncounterInput
}>

export type GroupRewardRunOrigin = Readonly<{
  rewardEngineVersion: string
  catalogContentHash: string
  generatorPreset?: Readonly<{
    id: string
    revision: number
    configHash: string
  }>
  input: GroupRewardGenerationInput
}>

/** Workflow and command IDs are intentionally absent from both origin shapes. */
export function sessionRunOriginFingerprint(origin: SessionRunOrigin): string {
  return fingerprint({
    runKind: 'session',
    encounterEngineVersion: origin.encounterEngineVersion,
    rewardEngineVersion: origin.rewardEngineVersion,
    catalogContentHash: origin.catalogContentHash,
    generatorPreset: origin.generatorPreset,
    input: origin.input
  })
}

export function groupRewardRunOriginFingerprint(
  origin: GroupRewardRunOrigin
): string {
  return fingerprint({
    runKind: 'group_reward',
    rewardEngineVersion: origin.rewardEngineVersion,
    catalogContentHash: origin.catalogContentHash,
    generatorPreset: origin.generatorPreset ?? null,
    input: origin.input
  })
}

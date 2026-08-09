import type {
  GeneratorPresetConfigV3,
  GeneratorPresetEditorSnapshot
} from '../../../shared/contracts/generator-presets.js'
import { canonicalGeneratorConfigJson } from '../../../shared/generator/generator-config-model.js'

export type GeneratorPresetDiscardIntent =
  Readonly<{ kind: 'close' }> | Readonly<{ kind: 'preset'; id: string }>

export type GeneratorPresetEditorPhase =
  'loading' | 'ready' | 'saving' | 'discard-confirmation' | 'conflict' | 'error'

export type GeneratorPresetEditorState = Readonly<{
  phase: GeneratorPresetEditorPhase
  snapshot: GeneratorPresetEditorSnapshot | null
  presetId: string | null
  presetName: string
  config: GeneratorPresetConfigV3 | null
  baseline: Readonly<{
    name: string
    config: GeneratorPresetConfigV3
  }> | null
  status: string | null
  discardIntent: GeneratorPresetDiscardIntent | null
}>

export type GeneratorPresetEditorAction =
  | Readonly<{
      type: 'loaded'
      snapshot: GeneratorPresetEditorSnapshot
      presetId?: string | null
      status?: string | null
    }>
  | Readonly<{ type: 'select'; presetId: string }>
  | Readonly<{ type: 'draft-name'; name: string }>
  | Readonly<{ type: 'draft-config'; config: GeneratorPresetConfigV3 }>
  | Readonly<{ type: 'saving' }>
  | Readonly<{
      type: 'saved'
      snapshot: GeneratorPresetEditorSnapshot
      presetId: string
      status: string
    }>
  | Readonly<{
      type: 'registry-updated'
      snapshot: GeneratorPresetEditorSnapshot
      status: string
      selectEffective?: boolean
    }>
  | Readonly<{
      type: 'request-discard'
      intent: GeneratorPresetDiscardIntent
    }>
  | Readonly<{ type: 'cancel-discard' }>
  | Readonly<{
      type: 'stale'
      draftConflict: boolean
      snapshot: GeneratorPresetEditorSnapshot
      status: string
    }>
  | Readonly<{ type: 'error'; status: string }>
  | Readonly<{ type: 'status'; status: string | null }>
  | Readonly<{ type: 'reset'; status: string }>

export const initialGeneratorPresetEditorState: GeneratorPresetEditorState = {
  phase: 'loading',
  snapshot: null,
  presetId: null,
  presetName: '',
  config: null,
  baseline: null,
  status: null,
  discardIntent: null
}

export function generatorPresetEditorReducer(
  state: GeneratorPresetEditorState,
  action: GeneratorPresetEditorAction
): GeneratorPresetEditorState {
  switch (action.type) {
    case 'loaded':
    case 'saved':
      return selectFrom(
        {
          ...state,
          phase: 'ready',
          snapshot: action.snapshot,
          status: action.status ?? null,
          discardIntent: null
        },
        action.type === 'saved'
          ? action.presetId
          : (action.presetId ?? effectivePresetId(action.snapshot))
      )
    case 'select':
      return selectFrom(
        { ...state, phase: 'ready', status: null, discardIntent: null },
        action.presetId
      )
    case 'draft-name':
      return { ...state, presetName: action.name, status: null }
    case 'draft-config':
      return { ...state, config: action.config, status: null }
    case 'saving':
      return { ...state, phase: 'saving', status: null }
    case 'registry-updated': {
      const next = {
        ...state,
        phase: 'ready' as const,
        snapshot: action.snapshot,
        status: action.status,
        discardIntent: null
      }
      return action.selectEffective
        ? selectFrom(next, effectivePresetId(action.snapshot))
        : next
    }
    case 'request-discard':
      return {
        ...state,
        phase: 'discard-confirmation',
        discardIntent: action.intent
      }
    case 'cancel-discard':
      return { ...state, phase: 'ready', discardIntent: null }
    case 'stale':
      return {
        ...state,
        phase: action.draftConflict ? 'conflict' : 'ready',
        snapshot: action.snapshot,
        status: action.status,
        discardIntent: null
      }
    case 'error':
      return { ...state, phase: 'error', status: action.status }
    case 'status':
      return { ...state, status: action.status }
    case 'reset':
      return state.baseline
        ? {
            ...state,
            phase: 'ready',
            presetName: state.baseline.name,
            config: state.baseline.config,
            status: action.status
          }
        : state
  }
}

export function generatorPresetEditorDirty(
  state: GeneratorPresetEditorState
): boolean {
  return (
    state.config !== null &&
    state.baseline !== null &&
    (state.presetName !== state.baseline.name ||
      canonicalGeneratorConfigJson(state.config) !==
        canonicalGeneratorConfigJson(state.baseline.config))
  )
}

function effectivePresetId(snapshot: GeneratorPresetEditorSnapshot) {
  return (
    snapshot.assignment?.effectivePresetId ??
    snapshot.registry.presets[0]?.id ??
    null
  )
}

function selectFrom(
  state: GeneratorPresetEditorState,
  id: string | null
): GeneratorPresetEditorState {
  const preset =
    state.snapshot?.registry.presets.find((candidate) => candidate.id === id) ??
    state.snapshot?.registry.presets[0]
  if (!preset) return state
  return {
    ...state,
    presetId: preset.id,
    presetName: preset.name,
    config: preset.config,
    baseline: preset
  }
}

import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useState
} from 'react'
import './encounter-generator-settings.css'
import type {
  GeneratorPresetConfigV3,
  GeneratorPresetEditorSnapshot,
  GeneratorRole
} from '../../../shared/contracts/generator-presets.js'
import {
  DiscardChangesDialog,
  ModalCloseButton,
  ModalDialog
} from '../../shell/modal-dialog.js'
import { message } from '../../i18n/generator-runtime.de.js'
import type { GeneratorPresetApplicationPort } from './generator-preset-application.js'
import { capabilityErrorCode } from '../../../shared/errors/capability-error.js'
import {
  generatorPresetEditorDirty,
  generatorPresetEditorReducer,
  initialGeneratorPresetEditorState,
  type GeneratorPresetEditorAction
} from './generator-preset-editor-state.js'
import { GeneratorRoleMatrix } from './generator-role-matrix.js'
import { GeneratorPresetToolbar } from './generator-preset-toolbar.js'
import { GeneratorDifficultyDistribution } from './generator-difficulty-distribution.js'
import {
  GeneratorCompositionRules,
  GeneratorRoleCombinations,
  GeneratorRoleQuantities
} from './generator-composition-rules.js'
import type { CampaignRewardRulesPort } from './campaign-reward-rules-port.js'
import { GeneratorLootRulesEditor } from './generator-loot-rules.js'
import { validateLootRuleDraft } from '../../../shared/generator/loot-rule-metadata.js'

const LazyCampaignRewardRulesCard = lazy(async () => {
  const module = await import('./campaign-reward-rules-card.js')
  return { default: module.CampaignRewardRulesCard }
})

export function EncounterGeneratorSettings(props: {
  application: GeneratorPresetApplicationPort
  campaignRules?: CampaignRewardRulesPort
  activeCampaignId: string | null
  partySize: number
  onClose: () => void
  onError: (message: string) => void
}) {
  const [editor, dispatch] = useReducer(
    generatorPresetEditorReducer,
    initialGeneratorPresetEditorState
  )
  const { snapshot, presetId, presetName, config, status, discardIntent } =
    editor
  const [combinationDraft, setCombinationDraft] = useState<GeneratorRole[]>([])
  const busy = editor.phase === 'saving'
  const conflict = editor.phase === 'conflict'
  const dirty = generatorPresetEditorDirty(editor)
  const changeConfig = useCallback(
    (next: GeneratorPresetConfigV3) =>
      dispatch({ type: 'draft-config', config: next }),
    []
  )

  useEffect(() => {
    let live = true
    void props.application
      .read()
      .then((next) => {
        if (!live) return
        dispatch({ type: 'loaded', snapshot: next })
      })
      .catch((error: unknown) => {
        const status = report(error, props.onError)
        dispatch({ type: 'error', status })
      })
    return () => {
      live = false
    }
  }, [props.application, props.onError])

  const selectedPreset = snapshot?.registry.presets.find(
    (preset) => preset.id === presetId
  )

  const save = async (forceCopy = false) => {
    if (!snapshot || !config || (!selectedPreset && !forceCopy)) return
    if (presetName.trim().length === 0) {
      dispatch({
        type: 'status',
        status: message('g.status.nameRequired')
      })
      return
    }
    if (!validGeneratorDraft(config)) {
      dispatch({ type: 'status', status: message('g.status.invalid') })
      return
    }
    dispatch({ type: 'saving' })
    try {
      const copy = forceCopy || selectedPreset?.protected === true
      const result = copy
        ? await props.application.create(
            forceCopy || presetName === selectedPreset?.name
              ? `${presetName} Kopie`
              : presetName,
            config
          )
        : await props.application.update(selectedPreset!.id, presetName, config)
      const next = result.snapshot
      const saved = result.receipt.saved
      dispatch({
        type: 'saved',
        snapshot: next,
        presetId: saved.id,
        status: copy ? message('g.status.copied') : message('g.status.saved')
      })
    } catch (error) {
      await handleMutationError(error, true)
    }
  }

  const assign = async () => {
    if (!snapshot || !presetId || !props.activeCampaignId) return
    await runMutation(
      () => props.application.assign(presetId),
      (next) => ({
        type: 'registry-updated',
        snapshot: next,
        status: message('g.status.assigned')
      })
    )
  }

  const remove = async () => {
    if (!snapshot || !selectedPreset || selectedPreset.protected) return
    await runMutation(
      () => props.application.delete(selectedPreset.id),
      (next) => ({
        type: 'registry-updated',
        snapshot: next,
        status: message('g.status.deleted'),
        selectEffective: true
      })
    )
  }

  const runMutation = async (
    mutate: () => Promise<{ snapshot: GeneratorPresetEditorSnapshot }>,
    completed: (
      snapshot: GeneratorPresetEditorSnapshot
    ) => GeneratorPresetEditorAction
  ) => {
    dispatch({ type: 'saving' })
    try {
      dispatch(completed((await mutate()).snapshot))
    } catch (error) {
      await handleMutationError(error, false)
    }
  }

  const requestClose = () => {
    if (dirty) dispatch({ type: 'request-discard', intent: { kind: 'close' } })
    else props.onClose()
  }

  const requestPreset = (id: string) => {
    if (!snapshot || id === presetId) return
    if (dirty) {
      dispatch({ type: 'request-discard', intent: { kind: 'preset', id } })
      return
    }
    dispatch({ type: 'select', presetId: id })
  }

  const discardChanges = () => {
    const intent = discardIntent
    if (!intent) return
    if (intent.kind === 'close') {
      props.onClose()
      return
    }
    dispatch({ type: 'select', presetId: intent.id })
  }

  const handleMutationError = async (
    error: unknown,
    draftConflict: boolean
  ) => {
    if (capabilityErrorCode(error) !== 'stale') {
      dispatch({ type: 'error', status: report(error, props.onError) })
      return
    }
    try {
      const latest = await props.application.read()
      dispatch({
        type: 'stale',
        draftConflict,
        snapshot: latest,
        status: message(draftConflict ? 'g.conflict' : 'g.conflict.retry')
      })
    } catch (reloadError) {
      dispatch({
        type: 'error',
        status: report(reloadError, props.onError)
      })
    }
  }

  return (
    <>
      <ModalDialog
        className="encounter-settings-dialog"
        ariaLabel={message('menu.settings')}
        onClose={requestClose}
        dismissOnBackdrop
        busy={busy}
      >
        <header className="settings-dialog-header">
          <h2>{message('menu.settings')}</h2>
          <ModalCloseButton aria-label={message('action.close')}>
            ×
          </ModalCloseButton>
        </header>
        <div className="settings-dialog-body">
          {props.campaignRules && (
            <Suspense fallback={null}>
              <LazyCampaignRewardRulesCard
                key={props.activeCampaignId}
                campaignRules={props.campaignRules}
                activeCampaignId={props.activeCampaignId}
                onError={props.onError}
              />
            </Suspense>
          )}
          {!config || !snapshot ? (
            <p role="status">{message('g.loading')}</p>
          ) : (
            <section
              className="generator-settings-card"
              aria-labelledby="generator-title"
            >
              <GeneratorPresetToolbar
                snapshot={snapshot}
                presetId={presetId}
                presetName={presetName}
                busy={busy}
                dirty={dirty}
                activeCampaignId={props.activeCampaignId}
                select={requestPreset}
                rename={(name) => dispatch({ type: 'draft-name', name })}
                save={() => void save()}
                assign={() => void assign()}
                remove={() => void remove()}
              />

              <GeneratorRoleMatrix config={config} changed={changeConfig} />

              <div className="generator-rules-grid">
                <div className="generator-rule-column">
                  <GeneratorDifficultyDistribution
                    config={config}
                    changed={changeConfig}
                  />
                  <GeneratorRoleQuantities
                    config={config}
                    changed={changeConfig}
                  />
                </div>
                <GeneratorCompositionRules
                  config={config}
                  partySize={props.partySize}
                  changed={changeConfig}
                />
                <GeneratorRoleCombinations
                  config={config}
                  draft={combinationDraft}
                  setDraft={setCombinationDraft}
                  changed={changeConfig}
                />
              </div>
              <GeneratorLootRulesEditor
                value={config.loot}
                changed={(loot) => changeConfig({ ...config, loot })}
              />
              {status && (
                <p className="generator-settings-status" role="status">
                  {status}
                </p>
              )}
              {conflict && (
                <div className="generator-conflict-actions">
                  <button
                    type="button"
                    disabled={busy || !presetId}
                    onClick={() => {
                      if (presetId)
                        dispatch({ type: 'loaded', snapshot, presetId })
                    }}
                  >
                    {message('g.conflict.discard')}
                  </button>
                  <button
                    type="button"
                    disabled={busy || presetName.trim().length === 0}
                    onClick={() => void save(true)}
                  >
                    {message('g.conflict.copy')}
                  </button>
                </div>
              )}
            </section>
          )}
        </div>
        {config && (
          <footer className="settings-dialog-footer">
            <p>{message('g.installationHint')}</p>
            <div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  dispatch({
                    type: 'reset',
                    status: message('g.status.reset')
                  })
                }}
              >
                {message('g.reset')}
              </button>
              <ModalCloseButton className="primary">
                {message('action.close')}
              </ModalCloseButton>
            </div>
          </footer>
        )}
      </ModalDialog>
      {discardIntent && (
        <DiscardChangesDialog
          message={message('g.discardQuestion')}
          cancelLabel={message('g.continueEditing')}
          discardLabel={message('g.discard')}
          onCancel={() => dispatch({ type: 'cancel-discard' })}
          onDiscard={discardChanges}
        />
      )}
    </>
  )
}

function validGeneratorDraft(config: GeneratorPresetConfigV3): boolean {
  return (
    validLootDraft(config.loot) &&
    Object.values(config.scene.difficultyWeights).reduce(
      (sum, weight) => sum + weight,
      0
    ) === 100 &&
    config.composition.roleCombinations.length > 0 &&
    config.composition.roleCombinations.length <= 32
  )
}

function validLootDraft(value: unknown): boolean {
  return validateLootRuleDraft(value).length === 0
}

function report(error: unknown, onError: (message: string) => void): string {
  const text = error instanceof Error ? error.message : 'Unbekannter Fehler'
  onError(text)
  return text
}

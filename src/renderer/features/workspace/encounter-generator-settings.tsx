import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { generatorRoles } from '../../../shared/generator/generator-config-model.js'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useId,
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
import {
  GeneratorPresetReconciliationPendingError,
  type GeneratorPresetApplicationPort
} from './generator-preset-application.js'
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
  const [editor, rawDispatch] = useReducer(
    generatorPresetEditorReducer,
    initialGeneratorPresetEditorState
  )
  const current = useRef(initialGeneratorPresetEditorState)
  const pending = useRef<Promise<boolean> | null>(null)
  const rewardId = useId()
  const dispatch = useCallback((action: GeneratorPresetEditorAction) => {
    current.current = generatorPresetEditorReducer(current.current, action)
    rawDispatch(action)
  }, [])
  const { snapshot, presetId, presetName, config, status, discardIntent } =
    editor
  const [combinationDraft, rawSetCombinationDraft] = useState<GeneratorRole[]>(
    []
  )
  const reconciliationPending =
    editor.phase === 'reconciliation-pending' ||
    props.application.reconciliationPending()
  const saving = editor.phase === 'saving' || reconciliationPending
  const conflict = editor.phase === 'conflict'
  const dirty =
    generatorPresetEditorDirty(editor) || combinationDraft.length > 0
  const combination = useRef<GeneratorRole[]>([])
  const settled = useRef(false)
  const blocked = useMaintenanceDraft({
    label: `Generator-Preset: ${presetName || 'Einstellungen'}`,
    dependsOn: props.campaignRules ? [rewardId] : [],
    isDirty: () =>
      !settled.current &&
      (pending.current !== null ||
        props.application.reconciliationPending() ||
        generatorPresetEditorDirty(current.current) ||
        combination.current.length > 0),
    save: saveForMaintenance,
    discard: discardForMaintenance
  })
  const busy = saving || blocked
  const inputBlocked = useCallback(
    () =>
      maintenanceDraftCoordinator.isLocked() ||
      pending.current !== null ||
      current.current.phase === 'reconciliation-pending' ||
      props.application.reconciliationPending(),
    [props.application]
  )
  const edit = useCallback(
    (action: GeneratorPresetEditorAction) => {
      if (inputBlocked()) return
      settled.current = false
      dispatch(action)
    },
    [dispatch, inputBlocked]
  )
  const setCombinationDraft = (roles: GeneratorRole[]) => {
    if (inputBlocked()) return
    combination.current = roles
    rawSetCombinationDraft(roles)
    settled.current = false
  }
  function track(operation: () => Promise<boolean>): Promise<boolean> {
    if (pending.current) return pending.current
    const result = Promise.resolve()
      .then(operation)
      .finally(() => {
        pending.current = null
      })
    pending.current = result
    return result
  }
  async function saveForMaintenance(): Promise<boolean> {
    if (pending.current && !(await pending.current)) return false
    if (props.application.reconciliationPending() && !(await track(reconcile)))
      return false
    if (current.current.phase === 'conflict') return false
    if (
      generatorPresetEditorDirty(current.current) ||
      combination.current.length
    )
      return track(() => savePreset())
    return true
  }
  async function discardForMaintenance(): Promise<boolean> {
    if (pending.current) await pending.current
    if (props.application.reconciliationPending() && !(await track(reconcile)))
      return false
    dispatch({ type: 'reset', status: message('g.status.reset') })
    combination.current = []
    rawSetCombinationDraft([])
    props.onClose()
    settled.current = true
    return true
  }
  const requestSave = (copy = false) => {
    if (!inputBlocked()) return track(() => savePreset(copy))
  }
  const changeConfig = useCallback(
    (next: GeneratorPresetConfigV3) =>
      edit({ type: 'draft-config', config: next }),
    [edit]
  )

  useEffect(() => {
    let live = true
    void props.application
      .read()
      .then((next) => {
        if (!live) return
        dispatch({ type: 'loaded', snapshot: next })
        if (props.application.reconciliationPending())
          dispatch({
            type: 'reconciliation-pending',
            status: message('g.reconciliation.pending')
          })
      })
      .catch((error: unknown) => {
        const status = report(error, props.onError)
        dispatch({ type: 'error', status })
      })
    return () => {
      live = false
    }
  }, [dispatch, props.application, props.onError])

  const selectedPreset = snapshot?.registry.presets.find(
    (preset) => preset.id === presetId
  )

  const savePreset = async (forceCopy = false): Promise<boolean> => {
    const state = current.current
    let config = state.config
    const snapshot = state.snapshot
    const presetName = state.presetName
    const selectedPreset = snapshot?.registry.presets.find(
      (preset) => preset.id === state.presetId
    )
    if (
      !snapshot ||
      !config ||
      (!selectedPreset && !forceCopy) ||
      (state.phase === 'conflict' && !forceCopy)
    )
      return false
    if (combination.current.length) {
      const roles = generatorRoles.filter((role) =>
        combination.current.includes(role)
      )
      const existing = config.composition.roleCombinations
      const duplicate = existing.some(
        (entry) => entry.join('|') === roles.join('|')
      )
      if (
        !roles.length ||
        roles.length > 3 ||
        (!duplicate && existing.length >= 32)
      )
        return false
      if (!duplicate)
        config = {
          ...config,
          composition: {
            ...config.composition,
            roleCombinations: [...existing, roles]
          }
        }
      dispatch({ type: 'draft-config', config })
      combination.current = []
      rawSetCombinationDraft([])
    }
    if (presetName.trim().length === 0) {
      dispatch({
        type: 'status',
        status: message('g.status.nameRequired')
      })
      return false
    }
    if (!validGeneratorDraft(config)) {
      dispatch({ type: 'status', status: message('g.status.invalid') })
      return false
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
      return true
    } catch (error) {
      await handleMutationError(error, true)
      return false
    }
  }

  const assign = async () => {
    if (inputBlocked() || !snapshot || !presetId || !props.activeCampaignId)
      return
    await track(() =>
      runMutation(
        () => props.application.assign(presetId),
        (next) => ({
          type: 'registry-updated',
          snapshot: next,
          status: message('g.status.assigned')
        })
      )
    )
  }

  const remove = async () => {
    if (
      inputBlocked() ||
      !snapshot ||
      !selectedPreset ||
      selectedPreset.protected
    )
      return
    await track(() =>
      runMutation(
        () => props.application.delete(selectedPreset.id),
        (next) => ({
          type: 'registry-updated',
          snapshot: next,
          status: message('g.status.deleted'),
          selectEffective: true
        })
      )
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
      return true
    } catch (error) {
      await handleMutationError(error, false)
      return false
    }
  }

  const reconcile = async (): Promise<boolean> => {
    dispatch({ type: 'saving' })
    try {
      const result = await props.application.reconcile()
      const receipt = result.receipt
      switch (receipt.kind) {
        case 'created':
        case 'updated':
          dispatch({
            type: 'saved',
            snapshot: result.snapshot,
            presetId: receipt.saved.id,
            status: message('g.reconciliation.confirmed')
          })
          return true
        case 'assigned':
          dispatch({
            type: 'registry-updated',
            snapshot: result.snapshot,
            status: message('g.reconciliation.confirmed')
          })
          return true
        case 'deleted':
          dispatch({
            type: 'registry-updated',
            snapshot: result.snapshot,
            status: message('g.reconciliation.confirmed'),
            selectEffective: true
          })
          return true
      }
    } catch (error) {
      await handleMutationError(error, false)
      return false
    }
  }

  const requestClose = () => {
    if (inputBlocked()) return
    if (dirty || combination.current.length)
      dispatch({ type: 'request-discard', intent: { kind: 'close' } })
    else props.onClose()
  }

  const requestPreset = (id: string) => {
    if (inputBlocked() || !snapshot || id === presetId) return
    if (dirty) {
      dispatch({ type: 'request-discard', intent: { kind: 'preset', id } })
      return
    }
    dispatch({ type: 'select', presetId: id })
  }

  const discardChanges = () => {
    if (inputBlocked()) return
    const intent = discardIntent
    if (!intent) return
    combination.current = []
    rawSetCombinationDraft([])
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
    if (error instanceof GeneratorPresetReconciliationPendingError) {
      dispatch({
        type: 'reconciliation-pending',
        status: message('g.reconciliation.pending')
      })
      return
    }
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
                maintenanceId={rewardId}
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
              <fieldset className="generator-settings-fields" disabled={busy}>
                <GeneratorPresetToolbar
                  snapshot={snapshot}
                  presetId={presetId}
                  presetName={presetName}
                  busy={busy}
                  dirty={dirty}
                  activeCampaignId={props.activeCampaignId}
                  select={requestPreset}
                  rename={(name) => edit({ type: 'draft-name', name })}
                  save={() => void requestSave()}
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
              </fieldset>
              {status && (
                <p className="generator-settings-status" role="status">
                  {status}
                </p>
              )}
              {reconciliationPending && (
                <div className="generator-conflict-actions">
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => {
                      if (
                        !maintenanceDraftCoordinator.isLocked() &&
                        !pending.current
                      )
                        void track(reconcile)
                    }}
                  >
                    {message('g.reconciliation.check')}
                  </button>
                </div>
              )}
              {conflict && (
                <div className="generator-conflict-actions">
                  <button
                    type="button"
                    disabled={busy || !presetId}
                    onClick={() => {
                      if (presetId) edit({ type: 'loaded', snapshot, presetId })
                    }}
                  >
                    {message('g.conflict.discard')}
                  </button>
                  <button
                    type="button"
                    disabled={busy || presetName.trim().length === 0}
                    onClick={() => void requestSave(true)}
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
                  edit({
                    type: 'reset',
                    status: message('g.status.reset')
                  })
                  setCombinationDraft([])
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
          onCancel={() => edit({ type: 'cancel-discard' })}
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

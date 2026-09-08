import { maintenanceDraftCoordinator } from '../../shell/maintenance-draft-coordinator.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import { useMemo, useRef, useState } from 'react'
import type { WorldNpcDraft } from '../../../shared/contracts/world-npc.js'
import { message } from '../../i18n/catalog-runtime.de.js'
import {
  DiscardChangesDialog,
  ModalCloseButton,
  ModalDialog,
  ModalForm
} from '../../shell/modal-dialog.js'
import {
  SearchableSelect,
  type SearchableSelectOption
} from '../../shell/searchable-select.js'
import type { NpcCatalogController } from './npc-catalog-controller.js'

export function NpcCatalogEditor(props: {
  npc: NpcCatalogController['editing']
  conflict: string | null
  factions: NpcCatalogController['factions']
  locations: NpcCatalogController['locations']
  creatureOptions: readonly SearchableSelectOption[]
  searchCreatures: (query: string) => Promise<readonly SearchableSelectOption[]>
  close: () => void
  save: (draft: WorldNpcDraft) => Promise<boolean>
}) {
  const initial = useMemo<WorldNpcDraft>(
    () => ({
      displayName: props.npc?.displayName ?? '',
      creatureId: props.npc?.creatureId ?? '',
      lifecycle: props.npc?.lifecycle ?? 'active',
      appearance: props.npc?.appearance ?? '',
      behavior: props.npc?.behavior ?? '',
      history: props.npc?.history ?? '',
      notes: props.npc?.notes ?? '',
      dispositionModifier: props.npc?.dispositionModifier ?? 0,
      factionId: props.npc?.factionId ?? null,
      locationId: props.npc?.locationId ?? null
    }),
    [props.npc]
  )
  const [draft, setDraft] = useState<WorldNpcDraft>(initial)
  const [saving, setBusy] = useState(false)
  const draftRef = useRef(initial)
  const settled = useRef(false)
  const pending = useRef<Promise<boolean> | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const blocked = useMaintenanceDraft({
    label: `NSC: ${draft.displayName.trim() || 'Neuer NSC'}`,
    isDirty: () =>
      !settled.current &&
      (pending.current !== null ||
        JSON.stringify(draftRef.current) !== JSON.stringify(initial)),
    save: saveDraft,
    discard: discardDraft
  })
  const busy = saving || blocked
  function saveDraft(): Promise<boolean> {
    if (pending.current) return pending.current
    const value = draftRef.current
    if (!value.displayName.trim() || !value.creatureId.trim())
      return Promise.resolve(false)
    setBusy(true)
    pending.current = Promise.resolve()
      .then(() => props.save(value))
      .then((saved) => {
        if (saved) settled.current = true
        return saved
      })
      .finally(() => {
        pending.current = null
        setBusy(false)
      })
    return pending.current
  }
  async function discardDraft(): Promise<boolean> {
    if (pending.current) await pending.current.catch(() => false)
    draftRef.current = initial
    settled.current = true
    setDraft(initial)
    props.close()
    return true
  }
  const set = <K extends keyof WorldNpcDraft>(
    key: K,
    value: WorldNpcDraft[K]
  ) => {
    if (maintenanceDraftCoordinator.isLocked() || pending.current) return
    settled.current = false
    draftRef.current = { ...draftRef.current, [key]: value }
    setDraft(draftRef.current)
  }
  const requestClose = () => {
    if (maintenanceDraftCoordinator.isLocked() || pending.current) return
    if (dirty) setDiscardOpen(true)
    else props.close()
  }
  const options = props.creatureOptions.some(
    (option) => option.id === draft.creatureId
  )
    ? props.creatureOptions
    : draft.creatureId
      ? [
          ...props.creatureOptions,
          { id: draft.creatureId, label: draft.creatureId }
        ]
      : props.creatureOptions
  return (
    <>
      <ModalDialog
        className="npc-dialog"
        ariaLabel={props.npc ? message('npc.edit') : message('npc.create')}
        onClose={requestClose}
        busy={busy}
      >
        <ModalForm
          onSubmit={(event) => {
            event.preventDefault()
            if (maintenanceDraftCoordinator.isLocked() || pending.current)
              return
            void saveDraft().catch(() => {})
          }}
        >
          <header>
            <h2>{props.npc ? message('npc.edit') : message('npc.create')}</h2>
            <ModalCloseButton aria-label={message('ui.dialog.schliessen')}>
              ×
            </ModalCloseButton>
          </header>
          {props.conflict && (
            <p className="inline-error" role="alert">
              {props.conflict}
            </p>
          )}
          <fieldset className="npc-dialog-grid" disabled={busy}>
            <label>
              {message('ui.name')}
              <input
                aria-label={message('ui.name')}
                required
                maxLength={100}
                value={draft.displayName}
                onChange={(event) => set('displayName', event.target.value)}
              />
            </label>
            <SearchableSelect
              mode="single"
              label={message('npc.statblock')}
              options={options}
              searchOptions={props.searchCreatures}
              value={draft.creatureId || null}
              emptyText={message('npc.chooseStatblock')}
              searchPlaceholder={message('npc.searchStatblock')}
              noResultsText={message('catalog.noFilterMatch')}
              changed={(value) => {
                if (value) set('creatureId', value)
              }}
            />
            <label>
              {message('ui.status')}
              <select
                aria-label={message('ui.status')}
                value={draft.lifecycle}
                onChange={(event) =>
                  set(
                    'lifecycle',
                    event.target.value as WorldNpcDraft['lifecycle']
                  )
                }
              >
                <option value="active">{message('npc.active')}</option>
                <option value="defeated">{message('npc.defeated')}</option>
              </select>
            </label>
            <label>
              {message('npc.dispositionModifier')}
              <input
                aria-label={message('npc.dispositionModifier')}
                type="number"
                min={-50}
                max={50}
                value={draft.dispositionModifier}
                onChange={(event) =>
                  set('dispositionModifier', Number(event.target.value))
                }
              />
            </label>
            <label>
              {message('npc.faction')}
              <select
                aria-label={message('npc.faction')}
                value={draft.factionId ?? ''}
                onChange={(event) =>
                  set('factionId', event.target.value || null)
                }
              >
                <option value="">{message('catalog.none')}</option>
                {props.factions.map((faction) => (
                  <option key={faction.id} value={faction.id}>
                    {faction.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {message('npc.location')}
              <select
                aria-label={message('npc.location')}
                value={draft.locationId ?? ''}
                onChange={(event) =>
                  set('locationId', event.target.value || null)
                }
              >
                <option value="">{message('catalog.none')}</option>
                {props.locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.displayName}
                  </option>
                ))}
              </select>
            </label>
            <NpcTextArea
              label={message('npc.appearance')}
              value={draft.appearance}
              changed={(value) => set('appearance', value)}
            />
            <NpcTextArea
              label={message('npc.behavior')}
              value={draft.behavior}
              changed={(value) => set('behavior', value)}
            />
            <NpcTextArea
              label={message('npc.history')}
              value={draft.history}
              changed={(value) => set('history', value)}
            />
            <NpcTextArea
              label={message('ui.notizen')}
              value={draft.notes}
              changed={(value) => set('notes', value)}
              rows={5}
            />
          </fieldset>
          <footer>
            <ModalCloseButton>{message('action.cancel')}</ModalCloseButton>
            <button
              disabled={
                busy || !draft.displayName.trim() || !draft.creatureId.trim()
              }
            >
              {message('action.save')}
            </button>
          </footer>
        </ModalForm>
      </ModalDialog>
      {discardOpen && (
        <DiscardChangesDialog
          message={message('ui.ungespeicherte.aenderungen.verwerfen')}
          cancelLabel={message('action.cancel')}
          discardLabel={message('ui.aenderungen.verwerfen')}
          onCancel={() => setDiscardOpen(false)}
          onDiscard={() => {
            if (!maintenanceDraftCoordinator.isLocked() && !pending.current)
              void discardDraft()
          }}
        />
      )}
    </>
  )
}

function NpcTextArea(props: {
  label: string
  value: string
  changed: (value: string) => void
  rows?: number
}) {
  return (
    <label className="npc-dialog-wide">
      {props.label}
      <textarea
        aria-label={props.label}
        rows={props.rows ?? 3}
        maxLength={20_000}
        value={props.value}
        onChange={(event) => props.changed(event.target.value)}
      />
    </label>
  )
}

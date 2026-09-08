import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type Dispatch
} from 'react'
import { TreasureEditorController } from './treasure-editor-controller.js'
import { useMaintenanceDraft } from '../../shell/maintenance-drafts.js'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type {
  Treasure,
  TreasureAnchor,
  LootCatalogEntry,
  LootCatalogPage,
  LootCatalogQuery
} from '../../../shared/contracts/loot.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import './loot-dialogs.css'
import { useTreasureEditorPort } from './use-loot-ports.js'
import { TreasureDraftFields } from './treasure-draft-fields.js'
import { LootCatalogPane } from './loot-catalog-pane.js'
import {
  emptyEditableTreasureContainer,
  treasureDraftInvalid,
  type EditableTreasureDraft
} from './treasure-draft.js'
import {
  type TreasureContainerPatch,
  type TreasureDraftCommand,
  type TreasureItemPatch
} from './treasure-draft-reducer.js'
import { treasureDraftEditorMessagesDe } from './treasure-draft-editor-messages.de.js'

type TreasureEditorDialogProps = {
  snapshot: LiveSessionSnapshot
  initialAnchor: TreasureAnchor
  treasure: Treasure | null
  close: () => void
  saved: () => void | Promise<void>
  maintenanceId?: string
  onError: (message: string) => void
}
export function TreasureEditorDialog(props: TreasureEditorDialogProps) {
  return <TreasureEditorContent key={props.treasure?.id ?? 'new'} {...props} />
}
function TreasureEditorContent(props: TreasureEditorDialogProps) {
  const loot = useTreasureEditorPort()
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const [controller] = useState(
    () =>
      new TreasureEditorController(
        loot,
        props.treasure,
        treasureDraftFrom(props.treasure),
        props.treasure?.anchor ?? props.initialAnchor,
        {
          saved: props.saved,
          close: props.close
        }
      )
  )
  useLayoutEffect(() => {
    controller.updateCallbacks({ saved: props.saved, close: props.close })
  }, [controller, props.saved, props.close])
  const {
    draft,
    anchor,
    busy: saving,
    uncertain,
    error,
    closed
  } = useSyncExternalStore(controller.subscribe, controller.snapshot)
  const blocked = useMaintenanceDraft(
    {
      label: `Schatz: ${draft.label || 'Neuer Schatz'}`,
      isDirty: controller.dirty,
      save: controller.maintenanceSave,
      discard: controller.maintenanceDiscard
    },
    props.maintenanceId
  )
  const editingBlocked = blocked || saving || uncertain || closed
  const dispatchDraft = controller.dispatch
  const setAnchor = controller.setAnchor
  const close = () => {
    void controller.close()
  }
  const [catalogQuery, setCatalogQuery] = useState<
    Omit<LootCatalogQuery, 'runId' | 'catalogContentHash'>
  >({
    search: '',
    types: [],
    categories: [],
    rarities: [],
    offset: 0,
    limit: 30
  })
  const [catalogPage, setCatalogPage] = useState<LootCatalogPage | null>(null)
  const [catalogError, setCatalogError] = useState('')
  useEffect(() => {
    let current = true
    void loot
      .catalog({ ...catalogQuery, runId: null, catalogContentHash: null })
      .then((page) => {
        if (current) {
          setCatalogPage(page)
          setCatalogError('')
        }
      })
      .catch((cause: unknown) => {
        if (current) setCatalogError(capabilityErrorText(cause))
      })
    return () => {
      current = false
    }
  }, [catalogQuery, loot])
  const invalid = treasureDraftInvalid(draft)

  function patchItem(id: string, patch: TreasureItemPatch) {
    dispatchDraft({ kind: 'patch-item', id, patch })
  }

  function patchContainer(id: string, patch: TreasureContainerPatch) {
    dispatchDraft({ kind: 'patch-container', id, patch })
  }

  return (
    <ModalDialog
      className="treasure-editor-dialog"
      labelledBy="treasure-editor-title"
      onClose={close}
      busy={editingBlocked}
    >
      <header>
        <div>
          <p className="section-kicker">{message('loot.title')}</p>
          <h2 id="treasure-editor-title">
            {props.treasure ? message('loot.edit') : message('loot.add')}
          </h2>
        </div>
        <button
          type="button"
          className="compact"
          aria-label={message('ui.dialog.schliessen')}
          onClick={close}
          disabled={editingBlocked}
        >
          ×
        </button>
      </header>
      {error && <p role="alert">{error}</p>}
      {uncertain && (
        <button
          type="button"
          disabled={blocked || saving}
          onClick={() => void controller.retry()}
        >
          {message('loot.editorCheck')}
        </button>
      )}
      <div inert={editingBlocked} style={{ display: 'contents' }}>
        <label className="loot-label-field">
          {message('loot.anchor')}
          <select
            value={anchorKey(anchor)}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'unplaced') setAnchor({ kind: 'unplaced' })
              else if (
                value === `location:${focused.locationId}` &&
                focused.locationId
              )
                setAnchor({
                  kind: 'location',
                  locationId: focused.locationId,
                  lastKnownLabel: focused.locationName
                })
              else if (value.startsWith('group:')) {
                const group = focused.groups.find(
                  (candidate) => candidate.id === value.slice('group:'.length)
                )
                if (group)
                  setAnchor({
                    kind: 'group',
                    sceneId: focused.id,
                    groupId: group.id,
                    lastKnownLabel: group.name
                  })
              }
            }}
          >
            <option value="unplaced">{message('loot.unplaced')}</option>
            {focused.locationId && (
              <option value={`location:${focused.locationId}`}>
                {formatMessage('loot.locationNamed', {
                  name: focused.locationName
                })}
              </option>
            )}
            {focused.groups.map((group) => (
              <option key={group.id} value={`group:${group.id}`}>
                {formatMessage('loot.groupNamed', { name: group.name })}
              </option>
            ))}
            {anchor.kind !== 'unplaced' &&
              !anchorAvailableInScene(anchor, focused) && (
                <option value={anchorKey(anchor)}>
                  {formatMessage('loot.previousNamed', {
                    name: anchor.lastKnownLabel
                  })}
                </option>
              )}
          </select>
        </label>
        <TreasureDraftFields
          draft={draft}
          policy="catalog"
          messages={treasureDraftEditorMessagesDe()}
          labelChanged={(label) => dispatchDraft({ kind: 'set-label', label })}
          patchItem={patchItem}
          removeItem={(id) => dispatchDraft({ kind: 'remove-item', id })}
          patchContainer={patchContainer}
          removeContainer={(id) =>
            dispatchDraft({ kind: 'remove-container', id })
          }
          itemDefinitionReadOnly={() => true}
          addContainer={() =>
            dispatchDraft({
              kind: 'add-container',
              container: emptyEditableTreasureContainer()
            })
          }
        />
        <LootCatalogPane
          query={catalogQuery}
          page={catalogPage}
          error={catalogError}
          queryChanged={(patch, preserveOffset = false) =>
            setCatalogQuery((current) => ({
              ...current,
              ...patch,
              offset: preserveOffset ? (patch.offset ?? current.offset) : 0
            }))
          }
          add={(entry) => addCatalogEntry(entry, draft, dispatchDraft)}
        />
      </div>
      <footer>
        <button type="button" onClick={close} disabled={editingBlocked}>
          {message('loot.cancel')}
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={invalid || editingBlocked}
          onClick={() => void controller.save()}
        >
          {saving ? message('loot.saving') : message('loot.save')}
        </button>
      </footer>
    </ModalDialog>
  )
}

function treasureDraftFrom(treasure: Treasure | null): EditableTreasureDraft {
  return {
    label: treasure?.label ?? message('loot.new'),
    items: treasure?.items.length
      ? treasure.items.map((item) => ({
          draftId: item.id,
          persistedId: item.id,
          itemReference: item.itemReference,
          name: item.definition.name,
          quantity: item.quantity,
          unitValueCp: item.definition.unitValueCp,
          stackable: item.definition.stackable,
          containerId: item.containerId
        }))
      : [],
    containers:
      treasure?.containers.map((container) => ({
        draftId: container.id,
        persistedId: container.id,
        catalogContainerId:
          container.provenance.kind === 'manual'
            ? null
            : container.provenance.catalogContainerId,
        name: container.name,
        capacity: container.capacity
      })) ?? []
  }
}

function addCatalogEntry(
  entry: LootCatalogEntry,
  draft: EditableTreasureDraft,
  dispatch: Dispatch<TreasureDraftCommand>
): void {
  if (entry.kind === 'container') {
    dispatch({
      kind: 'add-container',
      container: {
        draftId: crypto.randomUUID(),
        catalogContainerId: entry.id,
        name: entry.defaultName,
        capacity: entry.capacity
      }
    })
    return
  }
  if (entry.itemReference.kind !== 'catalog')
    throw new Error('Catalog response contains a non-catalog item reference')
  const itemReference = entry.itemReference
  const existing = entry.stackable
    ? draft.items.find(
        (item) =>
          item.itemReference?.kind === 'catalog' &&
          item.itemReference.catalogContentHash ===
            itemReference.catalogContentHash &&
          item.itemReference.entryKind === entry.kind &&
          item.itemReference.catalogId === entry.id &&
          item.containerId === null
      )
    : null
  if (existing) {
    dispatch({
      kind: 'patch-item',
      id: existing.draftId,
      patch: { quantity: existing.quantity + 1 }
    })
    return
  }
  dispatch({
    kind: 'add-item',
    item: {
      draftId: crypto.randomUUID(),
      itemReference,
      name: entry.definition.name,
      quantity: 1,
      unitValueCp: entry.definition.unitValueCp,
      stackable: entry.definition.stackable,
      containerId: null
    }
  })
}

function anchorKey(anchor: TreasureAnchor): string {
  if (anchor.kind === 'location') return `location:${anchor.locationId}`
  if (anchor.kind === 'group') return `group:${anchor.groupId}`
  return 'unplaced'
}

function anchorAvailableInScene(
  anchor: TreasureAnchor,
  scene: LiveSessionSnapshot['scene']['scenes'][number]
): boolean {
  if (anchor.kind === 'location') return anchor.locationId === scene.locationId
  if (anchor.kind === 'group')
    return (
      anchor.sceneId === scene.id &&
      scene.groups.some((group) => group.id === anchor.groupId)
    )
  return true
}

import { useEffect, useReducer, useState, type Dispatch } from 'react'
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
  reduceTreasureDraft,
  type TreasureContainerPatch,
  type TreasureDraftCommand,
  type TreasureItemPatch
} from './treasure-draft-reducer.js'
import { treasureDraftEditorMessagesDe } from './treasure-draft-editor-messages.de.js'

export function TreasureEditorDialog(props: {
  snapshot: LiveSessionSnapshot
  initialAnchor: TreasureAnchor
  treasure: Treasure | null
  close: () => void
  saved: () => void
  onError: (message: string) => void
}) {
  const loot = useTreasureEditorPort()
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const [anchor, setAnchor] = useState<TreasureAnchor>(
    props.treasure?.anchor ?? props.initialAnchor
  )
  const [draft, dispatchDraft] = useReducer(
    (
      current: EditableTreasureDraft,
      command: TreasureDraftCommand
    ): EditableTreasureDraft => reduceTreasureDraft(current, command, 'manual'),
    props.treasure,
    treasureDraftFrom
  )
  const [saving, setSaving] = useState(false)
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

  async function save() {
    if (invalid) return
    setSaving(true)
    const items = draft.items.map((item) => ({
      id: item.persistedId,
      itemReference: item.itemReference!,
      quantity: item.quantity,
      containerId: item.containerId
    }))
    const containerDrafts = draft.containers.map((container) => ({
      id: container.persistedId ?? container.draftId,
      catalogContainerId: container.catalogContainerId,
      name: container.name,
      capacity: container.capacity
    }))
    try {
      if (props.treasure)
        await loot.update({
          commandId: crypto.randomUUID(),
          treasureId: props.treasure.id,
          expectedRevision: props.treasure.revision,
          label: draft.label,
          anchor,
          containers: containerDrafts,
          items
        })
      else
        await loot.create({
          commandId: crypto.randomUUID(),
          label: draft.label,
          anchor,
          containers: containerDrafts,
          items
        })
      props.saved()
    } catch (cause) {
      props.onError(capabilityErrorText(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalDialog
      className="treasure-editor-dialog"
      labelledBy="treasure-editor-title"
      onClose={props.close}
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
          onClick={props.close}
        >
          ×
        </button>
      </header>
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
      <footer>
        <button type="button" onClick={props.close}>
          {message('loot.cancel')}
        </button>
        <button
          type="button"
          className="primary-action"
          disabled={invalid || saving}
          onClick={() => void save()}
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

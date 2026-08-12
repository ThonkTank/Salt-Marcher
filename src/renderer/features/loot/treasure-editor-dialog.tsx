import { useReducer, useState } from 'react'
import type { LiveSessionSnapshot } from '../../../shared/contracts/live-session.js'
import type {
  Treasure,
  TreasureAnchor
} from '../../../shared/contracts/loot.js'
import { capabilityErrorText } from '../../capabilities/capability-errors.js'
import { ModalDialog } from '../../shell/modal-dialog.js'
import { formatMessage, message } from '../../i18n/session-runtime.de.js'
import './loot-dialogs.css'
import { useTreasureEditorPort } from './use-loot-ports.js'
import { TreasureDraftFields } from './treasure-draft-fields.js'
import {
  emptyEditableTreasureContainer,
  emptyEditableTreasureItem,
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
      name: item.name,
      quantity: item.quantity,
      unitValueCp: item.unitValueCp,
      stackable: item.stackable,
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
        policy="manual"
        messages={treasureDraftEditorMessagesDe()}
        labelChanged={(label) => dispatchDraft({ kind: 'set-label', label })}
        patchItem={patchItem}
        removeItem={(id) => dispatchDraft({ kind: 'remove-item', id })}
        patchContainer={patchContainer}
        removeContainer={(id) =>
          dispatchDraft({ kind: 'remove-container', id })
        }
        addItem={() =>
          dispatchDraft({
            kind: 'add-item',
            item: emptyEditableTreasureItem()
          })
        }
        addContainer={() =>
          dispatchDraft({
            kind: 'add-container',
            container: emptyEditableTreasureContainer()
          })
        }
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
          name: item.name,
          quantity: item.quantity,
          unitValueCp: item.unitValueCp,
          stackable: item.stackable,
          containerId: item.containerId
        }))
      : [emptyEditableTreasureItem()],
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

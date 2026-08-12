import { useState } from 'react'
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
  type EditableTreasureContainer,
  type EditableTreasureDraft,
  type EditableTreasureItem
} from './treasure-draft.js'

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
  const [draft, setDraft] = useState<EditableTreasureDraft>(() => ({
    label: props.treasure?.label ?? message('loot.new'),
    items: props.treasure?.items.length
      ? props.treasure.items.map((item) => ({
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
      props.treasure?.containers.map((container) => ({
        draftId: container.id,
        persistedId: container.id,
        catalogContainerId: container.catalogContainerId,
        name: container.name,
        capacity: container.capacity
      })) ?? []
  }))
  const [saving, setSaving] = useState(false)
  const invalid = treasureDraftInvalid(draft)

  function patchItem(id: string, patch: Partial<EditableTreasureItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.draftId === id ? { ...item, ...patch } : item
      )
    }))
  }

  function patchContainer(
    id: string,
    patch: Partial<EditableTreasureContainer>
  ) {
    setDraft((current) => ({
      ...current,
      containers: current.containers.map((container) =>
        container.draftId === id ? { ...container, ...patch } : container
      )
    }))
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
        labelChanged={(label) => setDraft((current) => ({ ...current, label }))}
        patchItem={patchItem}
        removeItem={(id) =>
          setDraft((current) => ({
            ...current,
            items: current.items.filter((item) => item.draftId !== id)
          }))
        }
        patchContainer={patchContainer}
        removeContainer={(id) =>
          setDraft((current) => ({
            ...current,
            containers: current.containers.filter(
              (container) => container.draftId !== id
            ),
            items: current.items.map((item) =>
              item.containerId === id ? { ...item, containerId: null } : item
            )
          }))
        }
        addItem={() =>
          setDraft((current) => ({
            ...current,
            items: [...current.items, emptyEditableTreasureItem()]
          }))
        }
        addContainer={() =>
          setDraft((current) => ({
            ...current,
            containers: [
              ...current.containers,
              emptyEditableTreasureContainer()
            ]
          }))
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

import { useState } from 'react'
import type { WorldNpcDraft } from '../../../shared/contracts/world-npc.js'
import {
  ModalCloseButton,
  ModalDialog,
  ModalForm
} from '../../shell/modal-dialog.js'
import { TextActionButton } from '../../shell/text-action-button.js'
import type { NpcCatalogController } from './npc-catalog-controller.js'
import { message } from '../../i18n/catalog-runtime.de.js'

export function NpcCatalogSection(props: { controller: NpcCatalogController }) {
  const controller = props.controller
  const factionName = (id: string | null) =>
    controller.factions.find((entry) => entry.id === id)?.displayName ?? '—'
  const locationName = (id: string | null) =>
    controller.locations.find((entry) => entry.id === id)?.displayName ?? '—'
  return (
    <>
      <div className="catalog-filters">
        <input
          aria-label={message('npc.search')}
          placeholder={message('npc.searchPlaceholder')}
          value={controller.search}
          onChange={(event) => controller.setSearch(event.target.value)}
        />
        <button onClick={() => controller.setEditing(null)}>
          {message('ui.erstellen')}
        </button>
      </div>
      <div className="catalog-table-wrap">
        <table className="catalog-table">
          <thead>
            <tr>
              <th>{message('ui.name')}</th>
              <th>{message('npc.statblock')}</th>
              <th>{message('ui.status')}</th>
              <th>{message('npc.faction')}</th>
              <th>{message('npc.location')}</th>
              <th>{message('ui.aktionen')}</th>
            </tr>
          </thead>
          <tbody>
            {controller.visible.map((npc) => (
              <tr key={npc.id}>
                <td>
                  <TextActionButton onClick={() => controller.setEditing(npc)}>
                    {npc.displayName}
                  </TextActionButton>
                </td>
                <td>{npc.creatureId}</td>
                <td>
                  {npc.lifecycle === 'active'
                    ? message('npc.active')
                    : message('npc.defeated')}
                </td>
                <td>{factionName(npc.factionId)}</td>
                <td>{locationName(npc.locationId)}</td>
                <td className="row-actions">
                  {controller.deleteId === npc.id ? (
                    <>
                      <button onClick={() => controller.setDeleteId(null)}>
                        {message('action.cancel')}
                      </button>
                      <button
                        className="danger"
                        onClick={() => void controller.remove(npc.id)}
                      >
                        {message('ui.bestaetigen')}
                      </button>
                    </>
                  ) : (
                    <button
                      className="danger"
                      onClick={() => controller.setDeleteId(npc.id)}
                    >
                      {message('ui.loeschen')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="catalog-footer">
        <span>
          {controller.visible.length} {message('ui.npcs')}
        </span>
      </footer>
      {controller.editing !== undefined && (
        <NpcDialog
          npc={controller.editing}
          factions={controller.factions}
          locations={controller.locations}
          close={() => controller.setEditing(undefined)}
          save={controller.save}
        />
      )}
    </>
  )
}

function NpcDialog(props: {
  npc: NpcCatalogController['editing']
  factions: NpcCatalogController['factions']
  locations: NpcCatalogController['locations']
  close: () => void
  save: (draft: WorldNpcDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState<WorldNpcDraft>(() => ({
    displayName: props.npc?.displayName ?? '',
    creatureId: props.npc?.creatureId ?? 'commoner',
    lifecycle: props.npc?.lifecycle ?? 'active',
    appearance: props.npc?.appearance ?? '',
    behavior: props.npc?.behavior ?? '',
    history: props.npc?.history ?? '',
    notes: props.npc?.notes ?? '',
    dispositionModifier: props.npc?.dispositionModifier ?? 0,
    factionId: props.npc?.factionId ?? null,
    locationId: props.npc?.locationId ?? null
  }))
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof WorldNpcDraft>(
    key: K,
    value: WorldNpcDraft[K]
  ) => setDraft((current) => ({ ...current, [key]: value }))
  return (
    <ModalDialog
      className="npc-dialog"
      ariaLabel={message('npc.edit')}
      onClose={props.close}
      busy={busy}
    >
      <ModalForm
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          void props.save(draft).catch(() => setBusy(false))
        }}
      >
        <header>
          <h2>{props.npc ? message('npc.edit') : message('npc.create')}</h2>
          <ModalCloseButton aria-label={message('ui.dialog.schliessen')}>
            ×
          </ModalCloseButton>
        </header>
        <div className="npc-dialog-grid">
          <label>
            {message('ui.name')}
            <input
              required
              maxLength={100}
              value={draft.displayName}
              onChange={(e) => set('displayName', e.target.value)}
            />
          </label>
          <label>
            {message('npc.statblockId')}
            <input
              required
              maxLength={300}
              value={draft.creatureId}
              onChange={(e) => set('creatureId', e.target.value)}
            />
          </label>
          <label>
            {message('ui.status')}
            <select
              value={draft.lifecycle}
              onChange={(e) =>
                set('lifecycle', e.target.value as WorldNpcDraft['lifecycle'])
              }
            >
              <option value="active">{message('npc.active')}</option>
              <option value="defeated">{message('npc.defeated')}</option>
            </select>
          </label>
          <label>
            {message('npc.dispositionModifier')}
            <input
              type="number"
              min={-50}
              max={50}
              value={draft.dispositionModifier}
              onChange={(e) =>
                set('dispositionModifier', Number(e.target.value))
              }
            />
          </label>
          <label>
            {message('npc.faction')}
            <select
              value={draft.factionId ?? ''}
              onChange={(e) => set('factionId', e.target.value || null)}
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
              value={draft.locationId ?? ''}
              onChange={(e) => set('locationId', e.target.value || null)}
            >
              <option value="">{message('catalog.none')}</option>
              {props.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="npc-dialog-wide">
            {message('npc.appearance')}
            <textarea
              rows={3}
              maxLength={20_000}
              value={draft.appearance}
              onChange={(e) => set('appearance', e.target.value)}
            />
          </label>
          <label className="npc-dialog-wide">
            {message('npc.behavior')}
            <textarea
              rows={3}
              maxLength={20_000}
              value={draft.behavior}
              onChange={(e) => set('behavior', e.target.value)}
            />
          </label>
          <label className="npc-dialog-wide">
            {message('npc.history')}
            <textarea
              rows={3}
              maxLength={20_000}
              value={draft.history}
              onChange={(e) => set('history', e.target.value)}
            />
          </label>
          <label className="npc-dialog-wide">
            {message('ui.notizen')}
            <textarea
              rows={5}
              maxLength={20_000}
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </label>
        </div>
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
  )
}

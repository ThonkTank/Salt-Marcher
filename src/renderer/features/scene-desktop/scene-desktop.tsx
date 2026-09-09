import { useCombatCommands } from '../encounter/use-combat-commands.js'
import { desktopXpDraftId } from './desktop-xp-draft-id.js'
import { useMaintenanceEditingBlocked } from '../../shell/maintenance-drafts.js'
import { useDraftTransition } from '../../shell/use-draft-transition.js'
import { DesktopRosterActions } from './desktop-roster-actions.js'
import { DesktopCharacters } from './desktop-characters.js'
import { useSessionWorkspaceController } from '../session/use-session-workspace-controller.js'
import { SessionDialogHost } from '../session/session-dialog-host.js'
import { SessionLootPanel } from '../session/session-groups-panel.js'
import {
  EncounterCrumbs,
  SessionEncounterPanel
} from '../encounter/encounter-panels.js'
import type { SessionTravelSlots } from '../session/session-travel-slots.js'
import { DesktopOverview } from './desktop-overview.js'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { WorkspaceSurfaceProps } from '../workspace/workspace-surface-props.js'
import { message } from '../../i18n/session-runtime.de.js'
import { useSceneDesktop } from './use-scene-desktop.js'
import { DesktopWindow } from './desktop-window.js'
import {
  desktopWindowBounds,
  desktopWindowIsVisible,
  type DesktopSize,
  type SnapSide
} from './desktop-geometry.js'
import { DesktopReader, DesktopSearch } from './desktop-references.js'
import { desktopWindowTitle } from './desktop-window-title.js'
import './scene-desktop.css'

export function SceneDesktop(
  props: WorkspaceSurfaceProps & { travel: SessionTravelSlots }
) {
  const { model, actions, lifecycleNotice } = useSessionWorkspaceController({
    ...props,
    followCombat: false
  })
  const focused = props.snapshot.scene.scenes.find(
    (scene) => scene.id === props.snapshot.scene.focusedSceneId
  )!
  const { projection, snapshot } = useSceneDesktop(props.campaignId, focused.id)
  const transition = useDraftTransition(`${props.campaignId}:${focused.id}`, {
    title: message('desktop.confirmWindowChange'),
    text: message('desktop.resolveBeforeWindowChange')
  })
  const editingBlocked = useMaintenanceEditingBlocked()
  const sceneTransition = useDraftTransition(
    `${props.campaignId}:${focused.id}`,
    {
      title: message('desktop.confirmSceneChange'),
      text: message('desktop.resolveBeforeSceneChange')
    }
  )
  const stage = useRef<HTMLDivElement>(null)
  const launcher = useRef<HTMLButtonElement>(null)
  const requestedFocus = useRef<{ sceneId: string; windowId: string } | null>(
    null
  )
  useLayoutEffect(() => {
    const request = requestedFocus.current
    requestedFocus.current = null
    if (request?.sceneId === focused.id)
      stage.current
        ?.querySelector<HTMLElement>(`[data-window-id="${request.windowId}"]`)
        ?.focus()
  }, [snapshot.state, focused.id])
  useLayoutEffect(() => {
    const windowId = snapshot.focusWindowId
    if (!windowId) return
    const frame = stage.current?.querySelector<HTMLElement>(
      `[data-window-id="${windowId}"]`
    )
    if (frame) {
      frame.focus()
      projection.acknowledgeFocus(windowId)
    }
  }, [projection, snapshot.focusWindowId, snapshot.state])
  const [size, setSize] = useState<DesktopSize>({ width: 800, height: 600 })
  const [preview, setPreview] = useState<{
    sceneId: string
    side: SnapSide | null
  } | null>(null)
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const measure = () =>
      setSize({
        width: Math.max(1, Math.floor(node.getBoundingClientRect().width)),
        height: Math.max(1, Math.floor(node.getBoundingClientRect().height))
      })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  const combatCommands = useCombatCommands(
    props.campaignId,
    focused.id,
    props.onError
  )
  const windows = snapshot.state?.windows ?? []
  const visible = windows.filter((window) => !window.minimized)
  const raised = visible.at(-1)?.id
  return (
    <section
      className="scene-desktop"
      data-scene-id={focused.id}
      aria-label={message('desktop.workspace')}
    >
      <header className="desktop-toolbar">
        <label>
          {message('desktop.scene')}
          <select
            aria-label={message('desktop.scene')}
            value={focused.id}
            disabled={editingBlocked}
            onChange={(event) => {
              const sceneId = event.target.value
              if (sceneId !== focused.id)
                sceneTransition.request(() => actions.focusScene(sceneId))
            }}
          >
            {props.snapshot.scene.scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {scene.title}
              </option>
            ))}
          </select>
        </label>
        <button
          ref={launcher}
          disabled={!snapshot.state || !!snapshot.error}
          onClick={() => {
            requestedFocus.current = {
              sceneId: focused.id,
              windowId: 'overview'
            }
            projection.dispatch({ type: 'open-overview' })
          }}
        >
          {message('desktop.overview')}
        </button>
        <button
          disabled={!snapshot.state || !!snapshot.error}
          onClick={() => {
            requestedFocus.current = { sceneId: focused.id, windowId: 'search' }
            projection.dispatch({ type: 'open-search' })
          }}
        >
          {message('desktop.search')}
        </button>
        {(['characters', 'map', 'combat', 'loot'] as const).map((kind) => (
          <button
            key={kind}
            disabled={!snapshot.state || !!snapshot.error}
            onClick={() => {
              requestedFocus.current = { sceneId: focused.id, windowId: kind }
              projection.dispatch({ type: `open-${kind}` })
            }}
          >
            {kind === 'characters'
              ? message('character.characters')
              : message(`desktop.${kind}`)}
          </button>
        ))}
        <small role="status">
          {snapshot.loading
            ? message('desktop.loading')
            : snapshot.saving
              ? message('desktop.saving')
              : ''}
        </small>
      </header>
      {snapshot.error != null && (
        <div className="desktop-error" role="alert">
          <span>{message('desktop.error')}</span>
          <button onClick={projection.reload}>
            {message('desktop.reload')}
          </button>
        </div>
      )}
      <div ref={stage} className="desktop-stage">
        {[...visible]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((window) => (
            <DesktopWindow
              key={`${focused.id}:${window.id}`}
              window={window}
              title={desktopWindowTitle(window)}
              zIndex={windows.indexOf(window) + 1}
              size={size}
              raised={window.id === raised}
              disabled={!!snapshot.error}
              others={visible
                .filter((other) => other.id !== window.id)
                .map((other) => desktopWindowBounds(other, size))}
              preview={(side) => setPreview({ sceneId: focused.id, side })}
              dispatch={(action) => {
                if (action.type === 'close' || action.type === 'minimize') {
                  transition.request(() => {
                    projection.dispatch(action)
                    launcher.current?.focus()
                  })
                } else projection.dispatch(action)
              }}
            >
              {window.kind === 'characters' ? (
                <DesktopCharacters
                  sceneId={focused.id}
                  campaignId={props.campaignId}
                  partyRevision={props.snapshot.party.revision}
                  actions={
                    <DesktopRosterActions
                      characterDraftIds={focused.partyMemberIds.map((id) =>
                        desktopXpDraftId(props.campaignId, focused.id, id)
                      )}
                      key={focused.id}
                      campaignId={props.campaignId}
                      sceneId={focused.id}
                      snapshot={props.snapshot}
                    />
                  }
                  members={focused.partyMemberIds.flatMap((id) =>
                    props.snapshot.party.members.filter(
                      (member) => member.id === id
                    )
                  )}
                  comparison={window.comparison}
                  change={(value) =>
                    projection.dispatch({ type: 'character-comparison', value })
                  }
                  openCharacter={props.openCharacter}
                  onError={props.onError}
                />
              ) : window.kind === 'search' ? (
                <DesktopSearch
                  window={window}
                  dispatch={projection.dispatch.bind(projection)}
                />
              ) : window.kind === 'reader' || window.kind === 'reference' ? (
                <DesktopReader
                  window={window}
                  dispatch={projection.dispatch.bind(projection)}
                />
              ) : window.kind === 'map' ? (
                <div className="desktop-map">
                  <button
                    className="desktop-map-controls-toggle"
                    aria-expanded={window.controlsOpen}
                    onClick={() =>
                      projection.dispatch({
                        type: 'map-controls',
                        value: !window.controlsOpen
                      })
                    }
                  >
                    {message('desktop.travelControls')}
                  </button>
                  {window.controlsOpen && (
                    <div className="desktop-travel-controls">
                      {props.travel.renderScenario({
                        openMap: () => {},
                        mapActive: true
                      })}
                    </div>
                  )}
                  <div className="desktop-map-canvas">
                    {props.travel.renderMap({
                      view: snapshot.state!.mapView,
                      renderActive: desktopWindowIsVisible(
                        window,
                        windows,
                        size
                      ),
                      changed: (value) => {
                        const state = projection.snapshot().state
                        if (state)
                          projection.dispatch({
                            type: 'map-view',
                            value: { ...state.mapView, cameras: value.cameras }
                          })
                      }
                    })}
                  </div>
                </div>
              ) : window.kind === 'combat' ? (
                <div className="desktop-combat">
                  <EncounterCrumbs
                    commands={combatCommands}
                    snapshot={props.snapshot}
                    loot={model.loot}
                    setSnapshot={props.setSnapshot}
                    onError={props.onError}
                  />
                  <SessionEncounterPanel
                    commands={combatCommands}
                    snapshot={props.snapshot}
                    loot={model.loot}
                    setSnapshot={props.setSnapshot}
                    onError={props.onError}
                    selection={snapshot.state!.combatSelection.filter((id) =>
                      focused.groups.some(
                        (group) => group.id === id && !group.archived
                      )
                    )}
                    selectionChanged={(value) =>
                      projection.dispatch({ type: 'combat-selection', value })
                    }
                    manageGroups={actions.manageGroups}
                    reinforce={actions.reinforce}
                    distribute={actions.distribute}
                    inspect={(creature) =>
                      actions.inspectCreature(creature.id, creature.name)
                    }
                  />
                </div>
              ) : window.kind === 'loot' ? (
                <SessionLootPanel model={model.groups} actions={actions} />
              ) : (
                <DesktopOverview
                  model={model}
                  actions={actions}
                  openCharacters={() =>
                    projection.dispatch({ type: 'open-characters' })
                  }
                />
              )}
            </DesktopWindow>
          ))}
        {preview?.sceneId === focused.id && preview.side && (
          <div
            className={`desktop-snap-preview ${preview.side}`}
            aria-hidden="true"
          />
        )}
      </div>
      <nav className="desktop-taskbar" aria-label={message('desktop.windows')}>
        {[...windows]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((window) => (
            <button
              key={window.id}
              aria-pressed={!window.minimized && window.id === raised}
              onClick={() => {
                requestedFocus.current = {
                  sceneId: focused.id,
                  windowId: window.id
                }
                projection.dispatch({ type: 'raise', id: window.id })
              }}
            >
              {window.minimized ? '▁ ' : ''}
              {desktopWindowTitle(window)}
            </button>
          ))}
        {windows.length === 0 && !snapshot.loading && (
          <small>{message('desktop.empty')}</small>
        )}
      </nav>
      {lifecycleNotice}
      {combatCommands.notice}
      {combatCommands.dialog}
      {transition.dialog}
      {sceneTransition.dialog}
      <SessionDialogHost
        model={model}
        actions={actions}
        onError={props.onError}
      />
    </section>
  )
}
